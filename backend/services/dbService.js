const { getDb } = require('../config/firebase');
const { collection, addDoc, getDocs, getDoc, query, orderBy, limit, where, onSnapshot, doc, deleteDoc, setDoc, updateDoc } = require('firebase/firestore');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Save loan application report to Firestore
 * @param {Object} report - Full report object
 * @returns {string|null} Document ID or null if DB unavailable
 */
async function saveReport(report) {
  const db = getDb();
  if (!db) {
    console.warn('⚠️  Firestore not available, skipping save');
    return null;
  }

  try {
    const addPromise = addDoc(collection(db, 'loan_applications'), {
      ...report,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    });

    // 5-second timeout to prevent indefinite hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore connection timeout')), 5000)
    );

    const docRef = await Promise.race([addPromise, timeoutPromise]);

    console.log('✅ Report saved to Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Firestore save error:', error.message);
    return null;
  }
}

/**
 * Retrieve all loan applications (admin)
 * @returns {Array} List of applications
 */
async function getApplications() {
  const db = getDb();
  if (!db) return [];

  try {
    const q = query(
      collection(db, 'loan_applications'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('❌ Firestore fetch error:', error.message);
    return [];
  }
}

async function registerAdmin(username, password) {
  const db = getDb();
  if (!db) return { success: false, error: 'Database unavailable' };

  try {
    const q = query(collection(db, 'admin_users'), where('username', '==', username));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return { success: false, error: 'Username already exists' };

    const pwdHash = hashPassword(password);
    const docRef = await addDoc(collection(db, 'admin_users'), {
      username,
      pwdHash,
      createdAt: new Date().toISOString()
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function loginAdmin(username, password) {
  // Hackathon Bypass: Allow hardcoded admin if database check fails or for quick access
  if (username === 'admin' && password === 'admin123') {
    return { success: true, token: 'static-demo-admin-token' };
  }

  const db = getDb();
  if (!db) return { success: false, error: 'Database unavailable' };

  try {
    const q = query(collection(db, 'admin_users'), where('username', '==', username));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { success: false, error: 'Invalid credentials' };

    const adminDoc = snapshot.docs[0].data();
    if (adminDoc.pwdHash !== hashPassword(password)) {
      return { success: false, error: 'Invalid credentials' };
    }

    return { success: true, token: snapshot.docs[0].id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Stream all loan applications in real-time
 * @param {Function} callback - Function to receive the data array
 * @returns {Function|null} Unsubscribe function, or null if DB unavailable
 */
function streamApplications(callback) {
  const db = getDb();
  if (!db) return null;

  try {
    const q = query(
      collection(db, 'loan_applications'),
      limit(50)
    );
    
    // onSnapshot listens to Firestore continuously
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      console.error('❌ Firestore stream error:', error.message);
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Firestore stream setup error:', error.message);
    return null;
  }
}

/**
 * Register a new portal user
 */
async function registerUser(name, email, password) {
  const db = getDb();
  if (!db) return { success: false, error: 'Database unavailable' };

  try {
    // Check if email already exists
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) return { success: false, error: 'Email already registered' };

    const pwdHash = hashPassword(password);
    const docRef = await addDoc(collection(db, 'users'), {
      name,
      email,
      pwdHash,
      createdAt: new Date().toISOString(),
    });

    return { success: true, token: docRef.id, name, userId: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Login a portal user with email + password
 */
async function loginUser(email, password) {
  const db = getDb();
  if (!db) return { success: false, error: 'Database unavailable' };

  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false, error: 'Invalid email or password' };

    const doc = snap.docs[0];
    const data = doc.data();
    if (data.pwdHash !== hashPassword(password)) {
      return { success: false, error: 'Invalid email or password' };
    }

    return { success: true, token: doc.id, name: data.name, userId: doc.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Auto-login/register an applicant by their name/PAN from the loan result
 */
async function applicantLogin(name, panNumber, docId) {
  const db = getDb();
  if (!db) return { success: false, error: 'Database unavailable' };

  try {
    // Try to find existing applicant record
    let q;
    if (panNumber) {
      q = query(collection(db, 'applicant_users'), where('panNumber', '==', panNumber));
    } else {
      q = query(collection(db, 'applicant_users'), where('name', '==', name), limit(1));
    }
    const snap = await getDocs(q);

    let userId;
    if (!snap.empty) {
      const applicantDoc = snap.docs[0];
      userId = applicantDoc.id;
      
      // Add the new docId to the legacy loanDocIds array if it exists
      if (docId) {
        const currentIds = applicantDoc.data().loanDocIds || [];
        if (!currentIds.includes(docId)) {
           await updateDoc(doc(db, 'applicant_users', userId), {
             loanDocIds: [...currentIds, docId]
           });
        }
      }
    } else {
      // Create new applicant record
      const docRef = await addDoc(collection(db, 'applicant_users'), {
        name,
        panNumber: panNumber || null,
        loanDocIds: docId ? [docId] : [],
        createdAt: new Date().toISOString(),
      });
      userId = docRef.id;
    }

    // Link the loan application to this user ID so it appears in their dashboard
    if (docId) {
      try {
        const loanRef = doc(db, 'loan_applications', docId);
        await updateDoc(loanRef, { userId });
      } catch (e) {
        console.error('Failed to link docId to userId:', e.message);
      }
    }

    return { success: true, token: userId, name, userId, isApplicant: true };
  } catch (error) {
    console.error('applicantLogin error:', error.message);
    return { success: false, error: 'Firebase connection failed. Please try again.' };
  }
}

/**
 * Upgrade a guest applicant to a fully registered user
 */
async function upgradeApplicant(userId, email, password) {
  const db = getDb();
  if (!db) return { success: false, error: 'Database unavailable' };

  try {
    // Check if email already exists in users collection
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) return { success: false, error: 'Email already registered' };

    // Get the applicant doc
    const applicantRef = doc(db, 'applicant_users', userId);
    const applicantSnap = await getDoc(applicantRef);
    if (!applicantSnap.exists()) {
      return { success: false, error: 'Applicant record not found' };
    }
    
    const applicantData = applicantSnap.data();
    const pwdHash = hashPassword(password);

    // Create the full user doc with the EXACT same ID
    await setDoc(doc(db, 'users', userId), {
      name: applicantData.name,
      email,
      pwdHash,
      createdAt: new Date().toISOString(),
      legacyLoanDocIds: applicantData.loanDocIds || [] // Keep reference to legacy loans
    });

    // Delete the applicant record so it doesn't duplicate
    await deleteDoc(applicantRef);

    return { success: true, token: userId, name: applicantData.name, userId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get loan applications for a specific user by their userId
 */
async function getUserLoans(userId) {
  const db = getDb();
  if (!db) return [];

  try {
    const fetchPromise = (async () => {
      let q;
      let extraLoans = [];

      // If it's a real userId (not a local fallback), filter by it
      if (userId && !userId.startsWith('local_')) {
        // Backward compatibility: fetch loans that were linked via loanDocIds before the userId patch
        try {
          let appData = null;
          
          // First check applicant_users
          const applicantSnap = await getDoc(doc(db, 'applicant_users', userId));
          if (applicantSnap.exists()) {
             appData = applicantSnap.data();
          } else {
             // Check registered users for legacy loans
             const userSnap = await getDoc(doc(db, 'users', userId));
             if (userSnap.exists()) {
               appData = userSnap.data();
               // Remap legacyLoanDocIds to loanDocIds for compatibility below
               if (appData.legacyLoanDocIds) {
                 appData.loanDocIds = appData.legacyLoanDocIds;
               }
             }
          }

          if (appData) {
             const loanDocIds = appData.loanDocIds || [];
             for (const id of loanDocIds) {
               const loanSnap = await getDoc(doc(db, 'loan_applications', id));
               if (loanSnap.exists()) {
                 extraLoans.push({ id: loanSnap.id, ...loanSnap.data() });
               }
             }

             // Ultimate fallback: find any orphaned loans matching the applicant's exact name
             if (appData.name) {
               const nameQuery = query(
                 collection(db, 'loan_applications'),
                 where('customerDetails.name', '==', appData.name),
                 limit(50)
               );
               const nameSnap = await getDocs(nameQuery);
               nameSnap.forEach(doc => {
                 extraLoans.push({ id: doc.id, ...doc.data() });
               });
             }
          }
        } catch(e) {
          console.error('Failed to fetch legacy loanDocIds or by name:', e);
        }

        q = query(
          collection(db, 'loan_applications'),
          where('userId', '==', userId),
          limit(50)
        );
      } else {
        // Guest: return recent applications
        q = query(
          collection(db, 'loan_applications'),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
      }
      const snap = await getDocs(q);
      const queriedLoans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Merge and deduplicate
      const allLoansMap = new Map();
      extraLoans.forEach(l => allLoansMap.set(l.id, l));
      queriedLoans.forEach(l => allLoansMap.set(l.id, l));
      
      return Array.from(allLoansMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    })();

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    );

    return await Promise.race([fetchPromise, timeout]);
  } catch (error) {
    console.error('getUserLoans error:', error.message);
    return [];
  }
}

/**
 * Soft delete an application (moves to trash with 3-day expiry)
 */
async function softDeleteApplication(id) {
  const db = getDb();
  if (!db) return { success: false, error: 'DB unavailable' };

  try {
    const docRef = doc(db, 'loan_applications', id);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return { success: false, error: 'Application not found' };

    const data = snap.data();
    const deletedAt = Date.now();
    const expiryAt = deletedAt + (3 * 24 * 60 * 60 * 1000); // 3 days

    // Move to deleted_applications (internal name, but UI says Expiry)
    await setDoc(doc(db, 'deleted_applications', id), {
      ...data,
      deletedAt,
      expiryAt,
      originalCollection: 'loan_applications'
    });

    // Remove from original
    await deleteDoc(docRef);

    return { success: true };
  } catch (error) {
    console.error('softDeleteApplication error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Restore a deleted application
 */
async function restoreApplication(id) {
  const db = getDb();
  if (!db) return { success: false, error: 'DB unavailable' };

  try {
    const docRef = doc(db, 'deleted_applications', id);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return { success: false, error: 'Deleted application not found' };

    const data = snap.data();
    const { deletedAt, expiryAt, originalCollection, ...originalData } = data;

    // Move back to loan_applications
    await setDoc(doc(db, 'loan_applications', id), originalData);

    // Remove from trash
    await deleteDoc(docRef);

    return { success: true };
  } catch (error) {
    console.error('restoreApplication error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Permanently delete application
 */
async function permanentDeleteApplication(id) {
  const db = getDb();
  if (!db) return { success: false, error: 'DB unavailable' };

  try {
    await deleteDoc(doc(db, 'deleted_applications', id));
    return { success: true };
  } catch (error) {
    console.error('permanentDeleteApplication error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Permanently delete ALL applications in trash
 */
async function emptyTrash() {
  const db = getDb();
  if (!db) return { success: false, error: 'DB unavailable' };

  try {
    const q = query(collection(db, 'deleted_applications'));
    const snapshot = await getDocs(q);
    let count = 0;
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, 'deleted_applications', d.id));
      count++;
    }
    return { success: true, count };
  } catch (error) {
    console.error('emptyTrash error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get all deleted applications
 */
async function getDeletedApplications() {
  const db = getDb();
  if (!db) return [];

  try {
    // Note: removed orderBy to avoid index-required PERMISSION_DENIED errors
    const q = query(collection(db, 'deleted_applications'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('getDeletedApplications error:', error.message);
    return [];
  }
}

/**
 * Update the admin decision on a CONDITIONAL application
 * @param {string} id - Document ID
 * @param {'APPROVED'|'REJECTED'} newDecision - Admin's final decision
 */
async function updateApplicationDecision(id, newDecision) {
  const db = getDb();
  if (!db) return { success: false, error: 'DB unavailable' };

  try {
    const docRef = doc(db, 'loan_applications', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return { success: false, error: 'Application not found' };

    await updateDoc(docRef, {
      decision: newDecision,
      adminReviewedAt: new Date().toISOString(),
      adminDecision: newDecision,
    });

    return { success: true };
  } catch (error) {
    console.error('updateApplicationDecision error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Background cleanup for expired applications
 */
async function cleanupExpiredApplications() {
  const db = getDb();
  if (!db) return 0;

  try {
    const now = Date.now();
    const q = query(collection(db, 'deleted_applications'), where('expiryAt', '<=', now));
    const snap = await getDocs(q);
    
    let count = 0;
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'deleted_applications', d.id));
      count++;
    }
    if (count > 0) console.log(`🧹 Cleaned up ${count} expired applications`);
    return count;
  } catch (error) {
    console.error('cleanupExpiredApplications error:', error.message);
    return 0;
  }
}

module.exports = {
  saveReport,
  getApplications,
  registerAdmin,
  loginAdmin,
  streamApplications,
  registerUser,
  loginUser,
  applicantLogin,
  upgradeApplicant,
  getUserLoans,
  softDeleteApplication,
  restoreApplication,
  permanentDeleteApplication,
  emptyTrash,
  getDeletedApplications,
  cleanupExpiredApplications,
  updateApplicationDecision,
};


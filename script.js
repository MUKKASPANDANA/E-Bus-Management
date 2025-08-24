// Firebase Configuration - Replace with your actual config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let userRole = null;

// Admin verification code - change this to a secure code
const ADMIN_VERIFICATION_CODE = "EBUS_ADMIN_2024";

// Logging utility
class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
        
        // Store logs for debugging (using in-memory storage instead of sessionStorage)
        try {
            if (!window.ebusLogs) window.ebusLogs = [];
            window.ebusLogs.push(logEntry);
            // Keep only last 100 logs
            if (window.ebusLogs.length > 100) {
                window.ebusLogs.shift();
            }
        } catch (e) {
            console.error('Failed to store log:', e);
        }
    }

    static info(message, data = null) {
        this.log('info', message, data);
    }

    static error(message, data = null) {
        this.log('error', message, data);
    }

    static warn(message, data = null) {
        this.log('warn', message, data);
    }

    static debug(message, data = null) {
        this.log('debug', message, data);
    }
}

// Utility Functions
function showPage(pageId) {
    Logger.info(`Navigating to page: ${pageId}`);
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load page-specific data
        if (pageId === 'dashboard' && currentUser) {
            loadDashboard();
        } else if (pageId === 'search') {
            loadBusSearch();
        }
    }
}

function showAlert(elementId, message, type = 'success') {
    const alertElement = document.getElementById(elementId);
    if (alertElement) {
        alertElement.textContent = message;
        alertElement.className = `alert alert-${type} show`;
        
        Logger.info(`Alert shown: ${type} - ${message}`);
        
        setTimeout(() => {
            alertElement.classList.remove('show');
        }, 5000);
    }
}

function showSpinner(spinnerId, show = true) {
    const spinner = document.getElementById(spinnerId);
    if (spinner) {
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
        }
    }
}

// Authentication Functions
function updateUI(user, role = null) {
    Logger.info('Updating UI for user', { user: user?.email, role });
    
    const guestNav = document.getElementById('guestNav');
    const loggedInNav = document.getElementById('loggedInNav');
    const welcomeMsg = document.getElementById('welcomeMsg');

    if (user && role) {
        currentUser = user;
        userRole = role;
        
        guestNav.classList.add('hidden');
        loggedInNav.classList.remove('hidden');
        welcomeMsg.textContent = `Welcome, ${user.displayName || user.email} (${role.toUpperCase()})`;
        
        showPage('dashboard');
    } else {
        currentUser = null;
        userRole = null;
        
        guestNav.classList.remove('hidden');
        loggedInNav.classList.add('hidden');
        
        showPage('home');
    }
}

// Show/Hide admin verification field based on user type selection
document.addEventListener('DOMContentLoaded', function() {
    const registerUserTypeSelect = document.getElementById('registerUserType');
    if (registerUserTypeSelect) {
        registerUserTypeSelect.addEventListener('change', function() {
            const adminField = document.getElementById('adminVerificationField');
            if (adminField) {
                if (this.value === 'admin') {
                    adminField.style.display = 'block';
                    document.getElementById('adminCode').required = true;
                } else {
                    adminField.style.display = 'none';
                    document.getElementById('adminCode').required = false;
                }
            }
        });
    }
});

// Login Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Login attempt started');
            
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const userType = document.getElementById('userType').value;
            
            if (!email || !password || !userType) {
                showAlert('loginAlert', 'Please fill in all fields', 'error');
                return;
            }

            showSpinner('loginSpinner', true);
            
            try {
                // Sign in with Firebase Auth
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Get user role from Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.role === userType) {
                        Logger.info('Login successful', { email, role: userData.role });
                        updateUI(user, userData.role);
                        showAlert('loginAlert', 'Login successful!', 'success');
                    } else {
                        await auth.signOut();
                        showAlert('loginAlert', 'Invalid user type selected', 'error');
                        Logger.warn('Login failed - invalid user type', { email, expectedRole: userType, actualRole: userData.role });
                    }
                } else {
                    await auth.signOut();
                    showAlert('loginAlert', 'User not found in database', 'error');
                    Logger.error('Login failed - user not in database', { email });
                }
                
            } catch (error) {
                Logger.error('Login error', { error: error.message, email });
                showAlert('loginAlert', getFirebaseErrorMessage(error), 'error');
            } finally {
                showSpinner('loginSpinner', false);
            }
        });
    }
});

// Register Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Registration attempt started');
            
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const userType = document.getElementById('registerUserType').value;
            const phone = document.getElementById('phone').value.trim();
            const adminCode = document.getElementById('adminCode').value.trim();

            if (password !== confirmPassword) {
                showAlert('registerAlert', 'Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                showAlert('registerAlert', 'Password must be at least 6 characters', 'error');
                return;
            }

            // Check admin verification code if admin type is selected
            if (userType === 'admin' && adminCode !== ADMIN_VERIFICATION_CODE) {
                showAlert('registerAlert', 'Invalid admin verification code', 'error');
                return;
            }

            showSpinner('registerSpinner', true);
            
            try {
                // Create user with Firebase Auth
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Update user profile
                await user.updateProfile({
                    displayName: `${firstName} ${lastName}`
                });
                
                // Save user data to Firestore
                await db.collection('users').doc(user.uid).set({
                    firstName,
                    lastName,
                    email,
                    phone,
                    role: userType,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isActive: true,
                    isVerified: userType === 'admin' ? true : false
                });
                
                Logger.info('Registration successful', { email, role: userType });
                showAlert('registerAlert', 'Registration successful! You can now login.', 'success');
                
                // Reset form
                document.getElementById('registerForm').reset();
                document.getElementById('adminVerificationField').style.display = 'none';
                
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    showPage('login');
                }, 2000);
                
            } catch (error) {
                Logger.error('Registration error', { error: error.message, email });
                showAlert('registerAlert', getFirebaseErrorMessage(error), 'error');
            } finally {
                showSpinner('registerSpinner', false);
            }
        });
    }
});

// Logout function
async function logout() {
    Logger.info('Logout initiated');
    try {
        await auth.signOut();
        Logger.info('Logout successful');
        updateUI(null);
    } catch (error) {
        Logger.error('Logout error', error);
    }
}

// Dashboard Functions
function loadDashboard() {
    Logger.info('Loading dashboard', { role: userRole });
    
    // Hide all dashboards first
    const dashboards = ['adminDashboard', 'driverDashboard', 'userDashboard'];
    dashboards.forEach(dashboardId => {
        const dashboard = document.getElementById(dashboardId);
        if (dashboard) {
            dashboard.classList.add('hidden');
        }
    });

    // Show appropriate dashboard based on user role
    if (userRole === 'admin') {
        const adminDashboard = document.getElementById('adminDashboard');
        if (adminDashboard) {
            adminDashboard.classList.remove('hidden');
            loadAdminStats();
        }
    } else if (userRole === 'driver') {
        const driverDashboard = document.getElementById('driverDashboard');
        if (driverDashboard) {
            driverDashboard.classList.remove('hidden');
            loadDriverData();
        }
    } else if (userRole === 'user') {
        const userDashboard = document.getElementById('userDashboard');
        if (userDashboard) {
            userDashboard.classList.remove('hidden');
            loadUserData();
        }
    }
}

// FIXED: Admin Functions with better error handling and fallback values
async function loadAdminStats() {
    Logger.info('Loading admin stats');
    
    // Set loading indicators
    const totalBusesElement = document.getElementById('totalBuses');
    const totalDriversElement = document.getElementById('totalDrivers');
    const totalUsersElement = document.getElementById('totalUsers');

    if (totalBusesElement) totalBusesElement.textContent = 'Loading...';
    if (totalDriversElement) totalDriversElement.textContent = 'Loading...';
    if (totalUsersElement) totalUsersElement.textContent = 'Loading...';
    
    try {
        Logger.info('Starting admin stats queries');
        
        // Load stats with individual error handling for each query
        let busCount = 0;
        let driverCount = 0;
        let userCount = 0;
        
        // Get buses count
        try {
            const busesSnapshot = await db.collection('buses').get();
            busCount = busesSnapshot.size;
            Logger.info('Buses loaded successfully', { count: busCount });
        } catch (error) {
            Logger.error('Error loading buses', error);
            // Try alternative query or set default
            busCount = 'Error';
        }
        
        // Get drivers count
        try {
            const driversSnapshot = await db.collection('users').where('role', '==', 'driver').get();
            driverCount = driversSnapshot.size;
            Logger.info('Drivers loaded successfully', { count: driverCount });
        } catch (error) {
            Logger.error('Error loading drivers', error);
            // Try loading all users and filter manually
            try {
                const allUsersSnapshot = await db.collection('users').get();
                let manualDriverCount = 0;
                allUsersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    if (userData.role === 'driver') {
                        manualDriverCount++;
                    }
                });
                driverCount = manualDriverCount;
                Logger.info('Drivers loaded via manual filtering', { count: driverCount });
            } catch (fallbackError) {
                Logger.error('Error in fallback driver query', fallbackError);
                driverCount = 'Error';
            }
        }
        
        // Get users count
        try {
            const usersSnapshot = await db.collection('users').where('role', '==', 'user').get();
            userCount = usersSnapshot.size;
            Logger.info('Users loaded successfully', { count: userCount });
        } catch (error) {
            Logger.error('Error loading users', error);
            // Try loading all users and filter manually
            try {
                const allUsersSnapshot = await db.collection('users').get();
                let manualUserCount = 0;
                allUsersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    if (userData.role === 'user') {
                        manualUserCount++;
                    }
                });
                userCount = manualUserCount;
                Logger.info('Users loaded via manual filtering', { count: userCount });
            } catch (fallbackError) {
                Logger.error('Error in fallback user query', fallbackError);
                userCount = 'Error';
            }
        }

        // Update UI with results
        if (totalBusesElement) totalBusesElement.textContent = busCount;
        if (totalDriversElement) totalDriversElement.textContent = driverCount;
        if (totalUsersElement) totalUsersElement.textContent = userCount;
        
        Logger.info('Admin stats updated successfully', {
            buses: busCount,
            drivers: driverCount,
            users: userCount
        });
        
    } catch (error) {
        Logger.error('Critical error loading admin stats', error);
        // Set error messages
        if (totalBusesElement) totalBusesElement.textContent = 'Error';
        if (totalDriversElement) totalDriversElement.textContent = 'Error';
        if (totalUsersElement) totalUsersElement.textContent = 'Error';
        
        // Show user-friendly error message
        const adminDashboard = document.getElementById('adminDashboard');
        if (adminDashboard) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-error show';
            errorDiv.textContent = 'Unable to load statistics. Please check your connection and try refreshing the page.';
            adminDashboard.insertBefore(errorDiv, adminDashboard.firstChild);
        }
    }
}

function showCreateDriverForm() {
    const form = document.getElementById('createDriverForm');
    if (form) {
        form.classList.remove('hidden');
    }
}

function hideCreateDriverForm() {
    const form = document.getElementById('createDriverForm');
    if (form) {
        form.classList.add('hidden');
        const driverForm = document.getElementById('driverCreationForm');
        if (driverForm) {
            driverForm.reset();
        }
    }
}

// Driver Creation Form Handler (for admin)
document.addEventListener('DOMContentLoaded', function() {
    const driverCreationForm = document.getElementById('driverCreationForm');
    if (driverCreationForm) {
        driverCreationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Creating driver account by admin');
            
            const name = document.getElementById('driverName').value.trim();
            const email = document.getElementById('driverEmail').value.trim();
            const password = document.getElementById('driverPassword').value;
            const phone = document.getElementById('driverPhone').value.trim();
            const license = document.getElementById('licenseNumber').value.trim();
            
            try {
                // For admin creating driver accounts, we'll add to pending drivers collection
                // and create a temporary password. In production, you'd send an email invitation.
                await db.collection('users').add({
                    firstName: name.split(' ')[0],
                    lastName: name.split(' ').slice(1).join(' '),
                    email,
                    phone,
                    licenseNumber: license,
                    role: 'driver',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: currentUser.uid,
                    isActive: true,
                    tempPassword: password, // In production, hash this or use email invitation
                    needsPasswordChange: true
                });
                
                Logger.info('Driver account created successfully by admin', { email });
                showAlert('createDriverAlert', 'Driver account created successfully! Driver can now register with these credentials.', 'success');
                hideCreateDriverForm();
                loadAdminStats(); // Refresh stats
                
            } catch (error) {
                Logger.error('Error creating driver account', error);
                showAlert('createDriverAlert', `Error creating driver account: ${error.message}`, 'error');
            }
        });
    }
});

// Driver Functions
async function loadDriverData() {
    Logger.info('Loading driver data');
    try {
        const busesSnapshot = await db.collection('buses')
            .where('driverId', '==', currentUser.uid)
            .get();
        
        const myBusesCountElement = document.getElementById('myBusesCount');
        if (myBusesCountElement) {
            myBusesCountElement.textContent = busesSnapshot.size;
        }
        
        // Load buses list
        const busesContainer = document.getElementById('busesContainer');
        if (busesContainer) {
            busesContainer.innerHTML = '';
            
            if (busesSnapshot.size === 0) {
                busesContainer.innerHTML = '<p>No buses added yet. Click "Add Bus Details" to get started!</p>';
            } else {
                busesSnapshot.forEach(doc => {
                    const bus = doc.data();
                    const busCard = createBusCard(bus, doc.id);
                    busesContainer.appendChild(busCard);
                });
            }
        }
        
        Logger.info('Driver data loaded', { busCount: busesSnapshot.size });
    } catch (error) {
        Logger.error('Error loading driver data', error);
        const myBusesCountElement = document.getElementById('myBusesCount');
        if (myBusesCountElement) {
            myBusesCountElement.textContent = 'Error loading';
        }
    }
}

function createBusCard(bus, busId) {
    const card = document.createElement('div');
    card.className = 'bus-card';
    card.innerHTML = `
        <div class="bus-number">${bus.busNumber || 'N/A'}</div>
        <div class="bus-route">${bus.source || 'N/A'} → ${bus.destination || 'N/A'}</div>
        <div style="margin-bottom: 10px;">
            <strong>Route:</strong> ${bus.route || 'N/A'}<br>
            <strong>Departure:</strong> ${bus.departureTime || 'N/A'}<br>
            <strong>Arrival:</strong> ${bus.arrivalTime || 'N/A'}<br>
            <strong>Fare:</strong> ₹${bus.fare || '0'}<br>
            <strong>Capacity:</strong> ${bus.capacity || '0'} seats
        </div>
        <span class="bus-status ${bus.isActive ? 'status-active' : 'status-inactive'}">
            ${bus.isActive ? 'Active' : 'Inactive'}
        </span>
    `;
    return card;
}

// Bus Form Functions
function showBusForm() {
    const form = document.getElementById('busInfoForm');
    if (form) {
        form.classList.remove('hidden');
    }
}

function hideBusForm() {
    const form = document.getElementById('busInfoForm');
    if (form) {
        form.classList.add('hidden');
        const busForm = document.getElementById('busDetailsForm');
        if (busForm) {
            busForm.reset();
        }
    }
}

function showBusTypeForm() {
    const form = document.getElementById('busTypeForm');
    if (form) {
        form.classList.remove('hidden');
    }
}

function hideBusTypeForm() {
    const form = document.getElementById('busTypeForm');
    if (form) {
        form.classList.add('hidden');
        const busTypeForm = document.getElementById('busTypeDetailsForm');
        if (busTypeForm) {
            busTypeForm.reset();
        }
    }
}

function showContactForm() {
    const form = document.getElementById('contactUpdateForm');
    if (form) {
        form.classList.remove('hidden');
        loadContactData();
    }
}

function hideContactForm() {
    const form = document.getElementById('contactUpdateForm');
    if (form) {
        form.classList.add('hidden');
    }
}

async function loadContactData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const fields = [
                { id: 'primaryPhone', field: 'phone' },
                { id: 'secondaryPhone', field: 'secondaryPhone' },
                { id: 'address', field: 'address' },
                { id: 'city', field: 'city' },
                { id: 'state', field: 'state' },
                { id: 'emergencyContact', field: 'emergencyContact' }
            ];

            fields.forEach(({ id, field }) => {
                const element = document.getElementById(id);
                if (element) {
                    element.value = userData[field] || '';
                }
            });
        }
    } catch (error) {
        Logger.error('Error loading contact data', error);
    }
}

// Bus Details Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const busDetailsForm = document.getElementById('busDetailsForm');
    if (busDetailsForm) {
        busDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Adding bus information');
            
            if (!currentUser) {
                showAlert('busInfoAlert', 'User not authenticated', 'error');
                return;
            }
            
            const busData = {
                busNumber: document.getElementById('busNumber').value.trim(),
                route: document.getElementById('busRoute').value.trim(),
                source: document.getElementById('busSource').value.trim(),
                destination: document.getElementById('busDestination').value.trim(),
                departureTime: document.getElementById('departureTime').value,
                arrivalTime: document.getElementById('arrivalTime').value,
                fare: parseFloat(document.getElementById('busFare').value) || 0,
                capacity: parseInt(document.getElementById('busCapacity').value) || 0,
                driverId: currentUser.uid,
                driverName: currentUser.displayName || currentUser.email,
                driverEmail: currentUser.email,
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Validate required fields
            const requiredFields = ['busNumber', 'route', 'source', 'destination', 'departureTime', 'arrivalTime'];
            const missingFields = requiredFields.filter(field => !busData[field]);
            
            if (missingFields.length > 0) {
                showAlert('busInfoAlert', `Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
                return;
            }
            
            if (busData.fare <= 0 || busData.capacity <= 0) {
                showAlert('busInfoAlert', 'Fare and capacity must be greater than 0', 'error');
                return;
            }
            
            try {
                await db.collection('buses').add(busData);
                Logger.info('Bus information added successfully', busData);
                showAlert('busInfoAlert', 'Bus information added successfully!', 'success');
                hideBusForm();
                loadDriverData(); // Refresh driver data
            } catch (error) {
                Logger.error('Error adding bus information', error);
                showAlert('busInfoAlert', `Error adding bus information: ${error.message}`, 'error');
            }
        });
    }
});

// Bus Type Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const busTypeDetailsForm = document.getElementById('busTypeDetailsForm');
    if (busTypeDetailsForm) {
        busTypeDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Adding bus type information');
            
            if (!currentUser) {
                showAlert('busTypeAlert', 'User not authenticated', 'error');
                return;
            }
            
            const busTypeData = {
                busType: document.getElementById('busTypeSelect').value,
                amenities: document.getElementById('amenities').value.trim(),
                fuelType: document.getElementById('fuelType').value,
                manufacturingYear: parseInt(document.getElementById('manufacturingYear').value) || 0,
                driverId: currentUser.uid,
                driverEmail: currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (!busTypeData.busType || !busTypeData.fuelType || busTypeData.manufacturingYear === 0) {
                showAlert('busTypeAlert', 'Please fill in all required fields', 'error');
                return;
            }
            
            try {
                await db.collection('busTypes').add(busTypeData);
                Logger.info('Bus type information added successfully', busTypeData);
                showAlert('busTypeAlert', 'Bus type information added successfully!', 'success');
                hideBusTypeForm();
            } catch (error) {
                Logger.error('Error adding bus type information', error);
                showAlert('busTypeAlert', `Error adding bus type information: ${error.message}`, 'error');
            }
        });
    }
});

// Contact Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const contactDetailsForm = document.getElementById('contactDetailsForm');
    if (contactDetailsForm) {
        contactDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Updating contact information');
            
            if (!currentUser) {
                showAlert('contactAlert', 'User not authenticated', 'error');
                return;
            }
            
            const contactData = {
                phone: document.getElementById('primaryPhone').value.trim(),
                secondaryPhone: document.getElementById('secondaryPhone').value.trim(),
                address: document.getElementById('address').value.trim(),
                city: document.getElementById('city').value.trim(),
                state: document.getElementById('state').value.trim(),
                emergencyContact: document.getElementById('emergencyContact').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Validate required fields
            const requiredFields = ['phone', 'address', 'city', 'state', 'emergencyContact'];
            const missingFields = requiredFields.filter(field => !contactData[field]);
            
            if (missingFields.length > 0) {
                showAlert('contactAlert', `Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
                return;
            }
            
            try {
                await db.collection('users').doc(currentUser.uid).update(contactData);
                Logger.info('Contact information updated successfully');
                showAlert('contactAlert', 'Contact information updated successfully!', 'success');
                hideContactForm();
            } catch (error) {
                Logger.error('Error updating contact information', error);
                showAlert('contactAlert', `Error updating contact information: ${error.message}`, 'error');
            }
        });
    }
});

// User Functions
function loadUserData() {
    Logger.info('Loading user data');
    // User-specific data loading can be implemented here
}

// Search Functions
function loadBusSearch() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    const travelDateInput = document.getElementById('travelDate');
    if (travelDateInput) {
        travelDateInput.value = today;
        travelDateInput.min = today;
    }
}

// Search Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Bus search initiated');
            
            const source = document.getElementById('searchSource').value.trim().toLowerCase();
            const destination = document.getElementById('searchDestination').value.trim().toLowerCase();
            const travelDate = document.getElementById('travelDate').value;
            const travelTime = document.getElementById('travelTime').value;
            
            if (!source || !destination) {
                showAlert('searchAlert', 'Please enter both source and destination', 'error');
                return;
            }
            
            showSpinner('searchSpinner', true);
            
            try {
                const busesSnapshot = await db.collection('buses').where('isActive', '==', true).get();
                const results = [];
                
                busesSnapshot.forEach(doc => {
                    const bus = doc.data();
                    const busSource = (bus.source || '').toLowerCase();
                    const busDestination = (bus.destination || '').toLowerCase();
                    
                    // Check if source and destination match (partial match)
                    if (busSource.includes(source) && busDestination.includes(destination)) {
                        results.push({ ...bus, id: doc.id });
                    }
                });
                
                displaySearchResults(results);
                Logger.info('Bus search completed', { resultsCount: results.length });
                
            } catch (error) {
                Logger.error('Error searching buses', error);
                const searchAlert = document.getElementById('searchAlert');
                if (searchAlert) {
                    showAlert('searchAlert', `Error searching buses: ${error.message}`, 'error');
                }
            } finally {
                showSpinner('searchSpinner', false);
            }
        });
    }
});

function displaySearchResults(buses) {
    const resultsContainer = document.getElementById('busResults');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    if (buses.length === 0) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <h3>No buses found</h3>
                <p>Try adjusting your search criteria</p>
            </div>
        `;
        return;
    }
    
    buses.forEach(bus => {
        const busCard = createSearchResultCard(bus);
        resultsContainer.appendChild(busCard);
    });
}

function createSearchResultCard(bus) {
    const card = document.createElement('div');
    card.className = 'bus-card';
    
    // Calculate estimated arrival time (mock implementation)
    const currentTime = new Date();
    const estimatedArrival = new Date(currentTime.getTime() + Math.random() * 60 * 60 * 1000); // Random 0-60 minutes
    
    card.innerHTML = `
        <div class="bus-number">${bus.busNumber || 'N/A'}</div>
        <div class="bus-route">${bus.source || 'N/A'} → ${bus.destination || 'N/A'}</div>
        <div style="margin-bottom: 15px;">
            <strong>Route:</strong> ${bus.route || 'N/A'}<br>
            <strong>Departure:</strong> ${bus.departureTime || 'N/A'}<br>
            <strong>Estimated Arrival:</strong> ${estimatedArrival.toLocaleTimeString()}<br>
            <strong>Fare:</strong> ₹${bus.fare || '0'}<br>
            <strong>Available Seats:</strong> ${Math.floor(Math.random() * (bus.capacity || 40))} / ${bus.capacity || 40}
        </div>
        <div style="display: flex; gap: 10px;">
            <span class="bus-status status-active">Available</span>
            <button class="btn btn-primary" style="font-size: 0.9rem; padding: 0.4rem 1rem;" 
                    onclick="bookBus('${bus.id}')">Book Now</button>
        </div>
    `;
    return card;
}

function bookBus(busId) {
    Logger.info('Bus booking initiated', { busId });
    alert('Booking feature will be implemented in the next version!');
}

// Contact Message Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const contactMessageForm = document.getElementById('contactMessageForm');
    if (contactMessageForm) {
        contactMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            Logger.info('Contact message submitted');
            
            const messageData = {
                name: document.getElementById('contactName').value.trim(),
                email: document.getElementById('contactEmail').value.trim(),
                subject: document.getElementById('contactSubject').value.trim(),
                message: document.getElementById('contactMessage').value.trim(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: currentUser ? currentUser.uid : null
            };
            
            if (!messageData.name || !messageData.email || !messageData.subject || !messageData.message) {
                showAlert('contactFormAlert', 'Please fill in all required fields', 'error');
                return;
            }
            
            try {
                await db.collection('contactMessages').add(messageData);
                Logger.info('Contact message saved successfully');
                showAlert('contactFormAlert', 'Message sent successfully! We will get back to you soon.', 'success');
                document.getElementById('contactMessageForm').reset();
            } catch (error) {
                Logger.error('Error sending contact message', error);
                showAlert('contactFormAlert', `Error sending message: ${error.message}`, 'error');
            }
        });
    }
});

// Firebase Error Message Helper
function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/user-not-found':
            return 'No user found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/email-already-in-use':
            return 'Email address is already registered.';
        case 'auth/weak-password':
            return 'Password is too weak. Use at least 6 characters.';
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'permission-denied':
            return 'Permission denied. Please check your authentication.';
        default:
            return error.message || 'An unexpected error occurred.';
    }
}

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    Logger.info('Auth state changed', { user: user?.email });
    
    if (user) {
        try {
            // Get role from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                updateUI(user, userData.role);
            } else {
                Logger.warn('User document not found in Firestore');
                await auth.signOut();
            }
        } catch (error) {
            Logger.error('Error fetching user data', error);
            await auth.signOut();
        }
    } else {
        updateUI(null);
    }
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    Logger.info('Ebus Management System initialized');
    
    // Set default page
    showPage('home');
    
    // Set today's date for search form
    const today = new Date().toISOString().split('T')[0];
    const travelDateInput = document.getElementById('travelDate');
    if (travelDateInput) {
        travelDateInput.value = today;
        travelDateInput.min = today;
    }
});

// Debug Functions
window.ebusDebug = {
    showLogs: () => {
        const logs = window.ebusLogs || [];
        console.table(logs.slice(-20));
    },
    clearLogs: () => {
        window.ebusLogs = [];
        console.log('Logs cleared');
    },
    getCurrentUser: () => currentUser,
    getUserRole: () => userRole,
    getAdminCode: () => ADMIN_VERIFICATION_CODE,
    testAdminStats: () => {
        if (userRole === 'admin') {
            loadAdminStats();
        } else {
            console.log('You must be logged in as admin to test this function');
        }
    },
    // Manual database check
    checkDatabase: async () => {
        try {
            console.log('Checking database collections...');
            
            const collections = ['users', 'buses', 'busTypes', 'contactMessages'];
            for (const collection of collections) {
                try {
                    const snapshot = await db.collection(collection).limit(1).get();
                    console.log(`${collection}: ${snapshot.size > 0 ? 'Contains data' : 'Empty'}`);
                } catch (error) {
                    console.log(`${collection}: Error - ${error.message}`);
                }
            }
        } catch (error) {
            console.error('Database check failed:', error);
        }
    }

};


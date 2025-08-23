Ebus Management Based Current Location System
1. Project Overview

This project is part of an Intelligent Transportation System (ITS), specifically focusing on Advanced Traveler Information Systems (ATIS). It provides real-time bus location and arrival prediction to reduce passenger wait times, improve ridership satisfaction, and enhance public transport usage.

The system enables:

Admins to manage drivers and buses.

Drivers to update bus details, type, and contact info.

Users to search for bus locations and view details based on source and destination.

2. Key Features
Admin Module

Create login credentials for drivers/travel agencies.

Manage bus and driver records.

Driver/Travel Module

Login using credentials.

Post bus details (bus info, type, and contact info).

User Module

Register and login to the platform.

Search buses by source and destination.

View real-time bus location and expected arrival time.

3. Technology Stack

Frontend: HTML, CSS, JavaScript

Backend: Firebase (Authentication, Firestore Database, Hosting)

Domain: Transport / Intelligent Transportation Systems

4. System Workflow

Admin Login

Admin logs in and creates accounts for drivers.

Driver/Travel Login

Driver logs in and posts bus details (route, bus type, contact info).

User Registration & Login

New users register; existing users log in.

Bus Search & Tracking

Users search by source/destination and get real-time bus locations.

Prediction Model (Future Scope)

Predict arrival times based on bus location and previous stop dwell times.

5. Project Architecture
[User Interface] -> [Firebase Authentication] -> [Firestore Database]
            ↑                      ↓
          Admin                Driver/Travel


Authentication: Firebase Authentication for Admin, Driver, and Users.

Database: Firestore stores bus details, driver info, and user data.

Hosting: Firebase Hosting (optional for deployment).

6. Database Structure (Firestore)
Users Collection:
    userId:
        name, email, password, registeredOn

Drivers Collection:
    driverId:
        name, email, busDetails, contactInfo

Buses Collection:
    busId:
        route, source, destination, type, currentLocation, contactInfo

7. Logging & Monitoring

Logging of every action (login, registration, bus updates) using JavaScript console logs / Firebase logs.

8. Test Cases

TC01 - Admin Login: Valid admin credentials → Redirect to Admin Dashboard.

TC02 - Driver Login: Valid driver credentials → Able to post bus details.

TC03 - User Registration: Invalid email → Show error.

TC04 - Search Bus: Enter valid source/destination → Display correct buses.

TC05 - Real-Time Updates: When driver updates location → Users see updated location instantly.

9. Optimization Techniques

Code Optimization: Modular JavaScript functions for login, posting data, searching buses.

Architecture Optimization: Firebase Firestore for fast data retrieval.

Scalability: Easy to integrate GPS tracking and machine learning for ETA prediction.

10. Deployment

Hosted on Firebase Hosting (or can be deployed locally).

Cloud-based, accessible from any device with internet.

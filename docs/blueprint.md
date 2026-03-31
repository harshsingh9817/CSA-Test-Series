# **App Name**: QuizMaster Hub

## Core Features:

- Secure User Authentication: Custom authentication system for Admin and Student users. Includes unique session enforcement, active session monitoring by admin (displaying logged-in user and 'pc' info), no autofill, and automatic logout after 1 hour of inactivity. Admin credentials: sunilsingh8896@gmail.com / sunil8896 (for initial MVP).
- Admin Session Management: Admin dashboard tab ('Current Active') to view all active user sessions and terminate any session, automatically logging out the user from all devices.
- Student Account Management: Admin dashboard tab ('Student') to create new student logins (Name, Course, Reg ID, Password, and a 'Notice' field for student-specific notes), view all existing student accounts, and delete accounts (rendering them unable to access the system).
- Question Paper Management: Admin dashboard tab ('Question') to add new question papers. Admin provides a paper name and a GitHub JSON link containing questions in an array format. The system then displays the total number of questions identified in the JSON.
- Question Content Analyzer: An AI tool that, upon uploading a question JSON link, performs a preliminary analysis of the question content, assessing potential topics, categories, or unusual formatting for admin review.
- Student Quiz Taking & Progress Tracking: Students can select and start a quiz based on available papers. For papers with more than 100 questions, students receive a subset of 100 unique questions. Quiz results are displayed instantly upon submission. User's progress (e.g., '1-100 completed', '1-200 completed') and total questions completed are tracked within a subcollection tied to the user and paper in Firestore. Questions will not repeat within a paper until all available questions (or 100-question blocks) have been presented. Upon completing the entire paper, it can be retaken from the beginning. This tracking enables showing the number of questions completed to the user upon login.
- Admin Dashboard Navigation: A structured admin interface with clear tabs for 'Student', 'Current Active Sessions', 'Question Paper Management', and 'Settings' (initially empty).

## Style Guidelines:

- Light color scheme to promote clarity and focus. Primary color (used for prominent UI elements): A professional and clear medium blue, HSL(215, 60%, 45%), converted to RGB hex: #2E7AB8.
- Background color: A very light, desaturated blue derived from the primary hue, HSL(215, 20%, 95%), converted to RGB hex: #EBF1F6.
- Accent color (for call-to-actions and highlights): An analogous, vibrant aquamarine, HSL(185, 80%, 55%), converted to RGB hex: #2DDBD9, providing high contrast.
- Headline and body text font: 'Inter', a modern grotesque-style sans-serif for optimal readability across all content, from dashboard tables to quiz questions.
- Use clear, functional, and professionally designed line icons that visually communicate their purpose within the educational and management context.
- Clean, structured, and responsive layouts for both admin and student interfaces, ensuring intuitive navigation and content presentation across devices. Emphasis on clear data tables and easy-to-read question formats.
- Subtle and functional animations for user feedback, such as transitions between screens or successful form submissions, avoiding distractions during quiz-taking.
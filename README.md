# Medhavi Hub - AI-Powered Interactive Textbook

Stop passively reading. Start conversing with your textbook.

Medhavi Hub transforms traditional textbooks into intelligent, context-aware AI study companions. Whether you're working through Physics derivations or decoding complex Cancer Biology diagrams, Medhavi delivers real-time, citation-backed assistance grounded strictly in your textbook.

---

## 🔗 Live Product

https://physics-mechanics.medhavi.io/

## 🎥 Demo Video

https://youtu.be/iT6pYsoCz60?si=hScq2kArf3iQki6f

[![Watch the Demo](https://img.youtube.com/vi/iT6pYsoCz60/0.jpg)](https://youtu.be/iT6pYsoCz60)

---

## 📖 Project Overview

Medhavi Hub is an AI-powered interactive learning platform designed to make textbooks conversational, verifiable, and deeply intuitive.

Instead of searching across multiple tabs or relying on generic AI responses, Medhavi anchors every answer directly to your selected textbook and chapter, ensuring trust, relevance, and academic integrity.

The system understands your reading context, remembers your conversation history, and enables you to:

- Ask step-by-step derivations  
- Generate concept-check questions  
- Request concise or detailed summaries  
- Break down complex formulas  
- Interpret diagrams and technical visuals  
- Verify every answer through textbook citations  

This transforms static content into an active learning environment.

---

## Core Features

### 1. Context-Aware AI Assistant

The assistant automatically knows:
- Which textbook you’re reading  
- Which chapter you’re in  
- Your ongoing conversation context  

No repeated prompting required.

---

### 2. Trust & Verify (Citation-Backed Answers)

Every response includes references directly from the textbook.

This ensures:
- Accuracy  
- Academic integrity  
- Transparency  
- Source traceability  

---

### 3. Interactive Study Mode

Students can:
- Request full step-by-step derivations  
- Ask for intuitive real-world analogies  
- Generate practice questions instantly  
- Create answer keys for self-testing  

The AI adapts to how you want to learn.

---

### 4. Complex Concept Simplification

From physics equations to medical diagrams, Medhavy:
- Unpacks formulas line-by-line  
- Explains symbolic notation  
- Interprets visuals in clear language  

---

## 🏗️ **System Architecture**

```

┌─────────────────────────────────────────────────────────────────┐
│                     AUTH HUB (Port 3000)                        │
├─────────────────────────────────────────────────────────────────┤
│  👑 Admin              │  👨‍🏫 Instructor      │  🎓 Student       │
│  • Manage All DB     │  • Add/Edit Books  │  • View Library  │
│  • System Config     │  • Manage Classes  │  • Join Classes  │
│  • Approve All       │  • Invite Students │  • Request Access│
├─────────────────────────────────────────────────────────────────┤
│                    📊 SUPABASE / CLERK STORAGE                   │
│  • Core Database: Classes, Enrollments, Invites, Assignments    │
│  • Clerk Metadata: Textbooks registry, access requests          │
└─────────────────────────────────────────────────────────────────┘
                                    ↕️
                            🔗 JWT Token Verification
                                    ↕️
┌─────────────────────┐                        ┌─────────────────────┐
│  TEXTBOOK 1         │                        │  TEXTBOOK 2         │
│  (Port 3001)        │                        │  (Port 3002)        │
├─────────────────────┤                        ├─────────────────────┤
│  🛡️ Middleware       │                        │  🛡️ Middleware       │
│  • Token validation │                        │  • Token validation │
│  • Session cookies  │                        │  • Session cookies  │
│  • Auth status bar  │                        │  • Auth status bar  │
├─────────────────────┤                        ├─────────────────────┤
│  📚 Protected       │                        │  📚 Protected       │
│      Content        │                        │      Content        │
└─────────────────────┘                        └─────────────────────┘
```

---

## 🚀 **Quick Start**

### **1. Clone Repository**
```bash
git clone <your-repo-url>
cd textbook-authentication-system
```

### **2. Setup Auth Hub**
```bash
cd textbook-hub
npm install
npm install jsonwebtoken @types/jsonwebtoken

# Create .env.local
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key" >> .env.local
echo "CLERK_SECRET_KEY=sk_test_your_secret" >> .env.local
echo "JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" >> .env.local

npm run dev  # Runs on http://localhost:3000
```

### **3. Protect Your Textbooks**
```bash
# Run the automated protection script
python3 protect_textbooks.py

# Follow prompts to:
# 1. Choose environment (development/production)
# 2. Set auth hub URL
# 3. Select textbooks to protect
```

### **4. Configure Admin Account**
```bash
# Start auth hub, sign up, then make yourself admin via Clerk UI:
# 1. Visit: http://localhost:3000/sign-up
# 2. Create your account
# 3. Go to: https://dashboard.clerk.com
# 4. Select your project → Users → Find your user
# 5. Edit user → Public metadata → Add: {"role": "admin"}
# 6. Save changes
```

### **5. Automated Protection Script**
```bash
# Use the included automation script to protect your textbooks
python3 scripts/textbook_protect_setup.py

# The script will:
# - Scan for Fumadocs projects automatically
# - Add authentication middleware to each textbook
# - Create environment files with auth hub URLs
# - Set up protected layouts with logout functionality
# - Configure TypeScript-compliant error handling
```

---

## 📁 **Project Structure**

### **Auth Hub (`textbook-hub/`)**
```
textbook-hub/
├── app/
│   ├── api/
│   │   ├── textbooks/              # Textbook CRUD operations
│   │   │   ├── route.ts            # GET all, POST new
│   │   │   └── [id]/route.ts       # PUT update, DELETE remove
│   │   ├── requests/               # Access request workflow
│   │   │   ├── route.ts            # GET pending, POST new
│   │   │   └── [id]/route.ts       # PUT approve/deny
│   │   ├── access/                 # Token management
│   │   │   ├── verify/route.ts     # Verify tokens from textbooks
│   │   │   └── generate-token/route.ts # Generate access tokens
│   │   ├── auth/logout/route.ts    # Secure logout with invalidation
│   │   └── users/me/route.ts       # Current user data
│   ├── dashboard/page.tsx          # Student dashboard
│   ├── admin/page.tsx              # Admin dashboard
│   ├── sign-in/[[...sign-in]]/page.tsx  # Login page
│   ├── sign-up/[[...sign-up]]/page.tsx  # Registration page
│   └── page.tsx                    # Home/landing page
├── components/
│   ├── AdminDashboard.tsx          # Admin control panel
│   ├── StudentDashboard.tsx        # Student textbook access
│   ├── LogoutButton.tsx            # Secure logout component
│   └── textbook/
│       ├── TextbookManager.tsx     # Admin textbook CRUD
│       └── TextbookCard.tsx        # Student textbook display
├── lib/
│   └── textbook-manager.ts         # Core business logic
└── types/
    └── textbook.ts                 # TypeScript interfaces
```

### **Protected Textbooks**
```
your-textbook/
├── middleware.ts                   # Authentication middleware
├── components/
│   └── ProtectedLayout.tsx        # Auth status bar
├── app/
│   ├── api/auth/logout/route.ts   # Clear textbook session
│   └── layout.tsx                 # Wrapped with protection
└── .env.local                     # Auth hub URL
```

---

## 🔄 **Detailed System Flows**

### **Student Login & Textbook Access Flow**
```
🎓 Student visits textbook URL: http://localhost:3001/chapter-1
         ↓
🛡️ Middleware intercepts request
         ↓
❓ Check: Has textbook_session cookie?
         ↓ (No cookie found)
❌ No valid authentication
         ↓
↩️ Redirect: http://localhost:3000/dashboard?blocked_url=http://localhost:3001/chapter-1
         ↓
🔐 Clerk authentication challenge
         ↓
✅ Student signs in successfully
         ↓
🎓 Student Dashboard loads
         ↓
📊 API calls in background:
    - GET /api/textbooks (fetch all textbooks)
    - GET /api/users/me (fetch user permissions)
         ↓
🧮 Dashboard filtering logic:
    - Filter out hidden textbooks (status !== 'hidden')
    - Show public textbooks immediately
    - Show private textbooks if user has access
    - Show request options for private textbooks without access
         ↓
🖱️ Student clicks "Open Textbook" button
         ↓
📡 POST /api/access/generate-token
    - Validate user has access to textbook
    - Check textbook status permissions
    - Generate JWT token with user + textbook binding
         ↓
🚀 Open new tab: http://localhost:3001/chapter-1?access_token=eyJhbGciOiJIUzI1NiIs...
         ↓
🛡️ Middleware intercepts again with token
         ↓
📡 POST /api/access/verify to auth hub:
    {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "textbookUrl": "http://localhost:3001"
    }
         ↓
🔍 Auth hub verification process:
    1. Decode JWT signature (prevent tampering)
    2. Check token expiration (24 hours max)
    3. Validate user exists in Clerk
    4. Check logout timestamp (prevent reuse)
    5. Validate textbook exists in metadata
    6. Check origin matches textbook URL
    7. Evaluate permission matrix (status + user access)
         ↓
✅ Verification successful: { hasAccess: true }
         ↓
🍪 Middleware sets session cookie
🔄 Redirect to clean URL: http://localhost:3001/chapter-1
         ↓
📚 Student can now read textbook content
⏰ Session valid for 24 hours without re-authentication
```

### **Admin Textbook Management Flow**
```
👑 Admin logs into auth hub
         ↓
🏠 Admin Dashboard loads
         ↓
📊 Background data fetching:
    - GET /api/textbooks → reads from system admin metadata
    - System admin = user with publicMetadata.systemData = true
         ↓
📚 Admin clicks "Add Textbook"
         ↓
📝 Form submission: POST /api/textbooks
    {
      "title": "Advanced Physics",
      "url": "http://localhost:3002",
      "status": "private"
    }
         ↓
💾 Storage process:
    1. Generate unique ID: tb_1755294345411_abc123
    2. Find system admin (systemData: true)
    3. Add textbook to systemAdmin.publicMetadata.textbooks[]
    4. Save updated metadata to Clerk
         ↓
🌐 CORS system automatically updates:
    - Extracts origin from new URL: http://localhost:3002
    - Adds to dynamic allowed origins list
    - Future requests from localhost:3002 will be allowed
         ↓
👥 All admins immediately see new textbook:
    - Any admin can now manage this textbook
    - Any admin can access this textbook
    - Textbook appears in all admin dashboards
         ↓
🎓 Students see textbook based on status:
    - public: Appears in "My Textbooks" immediately
    - private: Appears in "Available to Request"
    - hidden: Completely invisible to students
```

### **New Admin Access Logic**
```
👤 User gets promoted to admin (role: 'admin' added to metadata)
         ↓
🔄 Next login/dashboard visit:
         ↓
🔍 System checks: user.publicMetadata?.role === 'admin'
         ↓
✅ Admin privileges activated:
    - Can access ALL textbooks (regardless of access list)
    - Can see ALL textbooks in "View All Textbooks"
    - Can generate tokens for ANY textbook
    - Can manage users and approve requests
         ↓
📚 Admin views textbooks:
    - GET /api/textbooks → reads from system admin metadata
    - Returns ALL textbooks from centralized storage
    - Admin doesn't need individual permissions
         ↓
🎫 Admin opens textbook:
    - POST /api/access/generate-token always succeeds for admins
    - Token generation: hasAccess = userRole === 'admin' (always true)
    - Can access public, private, AND hidden textbooks
```

---

## 🔐 **Textbook Status Access Logic**

### **Public Textbook Access**
```typescript
// Status: "public"
// Logic: Anyone can access immediately

Student Dashboard Filtering:
if (textbook.status === 'public') {
  return true  // Show in "My Textbooks"
}

Token Generation:
if (textbook.status === 'public') {
  hasAccess = true  // Anyone can get token
}

Use Cases:
- General reference materials
- Open course textbooks
- Public educational resources
```

### **Private Textbook Access** 
```typescript
// Status: "private"  
// Logic: Requires explicit permission (access request workflow)

Student Dashboard Filtering:
if (textbook.status === 'private' && userAccess.includes(textbook.id)) {
  return true  // Show in "My Textbooks" if user has access
} else if (textbook.status === 'private' && !userAccess.includes(textbook.id)) {
  return "showInRequestSection"  // Show in "Available to Request"
}

Token Generation:
if (textbook.status === 'private') {
  hasAccess = userRole === 'admin' || userTextbookAccess.includes(textbookId)
}

Access Request Workflow:
1. Student sees textbook in "Available to Request"
2. Student clicks "Request Access"
3. Request stored in student's metadata
4. Admin sees request in dashboard
5. Admin approves → textbook ID added to student's access list
6. Student can now access textbook

Use Cases:
- Course-specific materials
- Advanced or specialized content
- Department-restricted resources
```

### **Hidden Textbook Access**
```typescript
// Status: "hidden"
// Logic: Admin-only access, completely invisible to students

Student Dashboard Filtering:
if (textbook.status === 'hidden') {
  return false  // NEVER show to students, regardless of access list
}

Token Generation:
if (textbook.status === 'hidden') {
  hasAccess = userRole === 'admin'  // Only admins can get tokens
}

Admin Access:
- ✅ Can see in "View All Textbooks"
- ✅ Can generate tokens and access content
- ✅ Can change status to make visible to students

Use Cases:
- Draft textbooks under development
- Instructor answer keys and solutions
- Administrative documentation
- Maintenance mode (temporarily hide problematic content)
```

---

## 🚪 **Logout Security Deep Dive**

### **Why We Clear All Session Cookies**
```typescript
// The Problem: Cross-Domain Session Persistence
Student has active sessions on:
- http://localhost:3000 (auth hub) ← Clerk session
- http://localhost:3001 (physics textbook) ← textbook_session cookie  
- http://localhost:3002 (chemistry textbook) ← textbook_session cookie
- http://localhost:3003 (math textbook) ← textbook_session cookie

// Standard logout only clears auth hub session
// Student would still have access to all textbooks!
```

### **Our Comprehensive Logout Process**
```typescript
// Step 1: Server-side token invalidation
POST /api/auth/logout:
await client.users.updateUserMetadata(userId, {
  publicMetadata: {
    ...user.publicMetadata,
    lastLogoutAt: Math.floor(Date.now() / 1000)  // Current timestamp
  }
})
// Effect: ALL tokens issued before this timestamp become invalid

// Step 2: Client-side cookie clearing
document.cookie.split(";").forEach(function(c) { 
  const name = c.split('=')[0].trim()
  
  // Clear for current domain
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
  
  // Clear for parent domain (production subdomains)
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + domain
})

// Step 3: Clear all browser storage
localStorage.clear()
sessionStorage.clear()

// Step 4: Force redirect to home page
window.location.replace(window.location.origin + '/')
```

### **Multi-Layer Security Protection**
```
🔒 Layer 1: Server-side timestamp invalidation
    - All existing tokens become invalid
    - Prevents token reuse attacks
    - Works across ALL textbooks simultaneously

🍪 Layer 2: Client-side cookie clearing  
    - Removes session cookies from browser
    - Handles multiple domains/subdomains
    - Prevents local session persistence

💾 Layer 3: Storage clearing
    - Removes any cached authentication data
    - Clears local/session storage
    - Ensures complete cleanup

🔄 Layer 4: Forced redirect
    - Immediately leaves authenticated area
    - Prevents UI confusion
    - Takes user to safe public area
```

---

## 📊 **Access Control Matrix**

| User Type | Public Textbooks | Private (No Access) | Private (Has Access) | Hidden Textbooks |
|-----------|------------------|-------------------|-------------------|------------------|
| **👤 Student** | ✅ Immediate access | 📝 Can request access | ✅ Full access | 👁️ Completely invisible |
| **👑 Admin** | ✅ Full access | ✅ Full access | ✅ Full access | ✅ Full access |
| **🚫 Logged Out** | ❌ Redirect to login | ❌ Redirect to login | ❌ Redirect to login | ❌ Redirect to login |

### **Status Change Impact on Existing Access**
```
📚 Textbook: "Advanced Chemistry" (tb_123)
👤 Student: Has access ID in their metadata

Scenario 1: Private → Hidden
- Student dashboard: Textbook disappears ❌
- Token generation: Blocked for student ❌
- Access preserved: ID stays in student's access list ✅
- Admin access: Unaffected ✅

Scenario 2: Hidden → Private  
- Student dashboard: Textbook reappears ✅
- Token generation: Allowed for student ✅
- Access restored: Using preserved ID ✅
- No re-approval needed: Seamless restoration ✅

Scenario 3: Private → Public
- Student dashboard: Remains visible ✅
- Token generation: Now available to everyone ✅
- Access list: Becomes irrelevant (everyone has access) ✅
- Other students: Now have immediate access ✅
```

---

## 🗄️ **Data Storage (Clerk Metadata)**

### **System Admin Storage**
```json
{
  "publicMetadata": {
    "role": "admin",
    "systemData": true,
    "lastLogoutAt": 1704729600,
    "textbooks": [
      {
        "id": "tb_1755294345411_abc123",
        "title": "Introduction to Physics",
        "description": "Complete physics course materials",
        "url": "http://localhost:3001",
        "imageUrl": "/uploads/physics-cover.jpg",
        "status": "public",
        "createdAt": "2025-01-15T10:30:00Z",
        "createdBy": "user_admin123",
        "createdByEmail": "admin@school.edu"
      }
    ]
  }
}
```

### **Student Storage**
```json
{
  "publicMetadata": {
    "role": "student",
    "lastLogoutAt": 1704726000,
    "textbookAccess": ["tb_1755294345411_abc123"],
    "accessRequests": [
      {
        "id": "req_1755294567890_xyz789",
        "textbookId": "tb_1755294345411_def456",
        "textbookTitle": "Advanced Chemistry",
        "status": "pending",
        "requestedAt": "2025-01-15T14:30:00Z"
      }
    ]
  }
}
```

---

## 🛡️ **Security Features**

### **Multi-Layer Security**
1. **🔐 JWT Cryptographic Signatures** - Prevents token tampering
2. **⏰ Token Expiration** - 24-hour automatic invalidation
3. **🚪 Logout Invalidation** - Timestamp-based token revocation
4. **🌐 Origin Validation** - Prevents cross-domain attacks  
5. **🛡️ Role-Based Access** - Admin/student permission separation
6. **🔒 Status-Based Control** - Public/private/hidden textbook visibility

### **Attack Prevention**
- **Token Reuse**: Logout timestamp prevents old token usage
- **Token Forgery**: JWT signatures prevent tampering
- **Cross-Domain**: Origin validation blocks unauthorized domains
- **Privilege Escalation**: Role validation in every API call
- **Session Hijacking**: HttpOnly cookies prevent client-side access

---

## 📊 **Textbook Status System**

| Status | Student Visibility | Student Access | Admin Access | Use Case |
|--------|-------------------|----------------|--------------|----------|
| **🌍 Public** | ✅ Always visible | ✅ Immediate access | ✅ Full access | Open course materials |
| **🔐 Private** | ✅ Can request | ✅ After approval | ✅ Full access | Restricted content |
| **👁️ Hidden** | ❌ Invisible | ❌ No access | ✅ Full access | Draft/maintenance |

### **Status Change Impact**
```
Public → Private: Students keep existing access, new students must request
Private → Hidden: All student access blocked, preserved for restoration  
Hidden → Public: Becomes accessible to everyone immediately
Private → Public: All restrictions removed, everyone gets access
```

---

## 🔌 **API Endpoints**

### **Authentication APIs**
- `POST /api/access/generate-token` - Generate textbook access token
- `POST /api/access/verify` - Verify token from textbook middleware

### **Textbook Management APIs**  
- `GET /api/textbooks` - Fetch all textbooks (admin only)
- `POST /api/textbooks` - Create new textbook (admin only)
- `PUT /api/textbooks/[id]` - Update textbook (admin only)
- `DELETE /api/textbooks/[id]` - Delete textbook + cleanup permissions

### **Access Request APIs**
- `GET /api/requests` - Get pending requests (admin only)
- `POST /api/requests` - Create access request (student only)
- `PUT /api/requests/[id]` - Approve/deny request (admin only)

### **User Management APIs**
- `GET /api/users/me` - Get current user data and permissions
- `POST /api/auth/logout` - Secure logout with token invalidation

---

## 🚀 **Deployment**

### **Environment Variables**

#### **Auth Hub**
```bash
# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
JWT_SECRET=your_256_bit_secret

# Optional
NEXTAUTH_URL=https://auth.yourschool.edu
NODE_ENV=production
```

#### **Each Textbook**
```bash
# Required
NEXT_PUBLIC_AUTH_HUB_URL=https://auth.yourschool.edu
NODE_ENV=production
```

### **Deployment Options**
- **Vercel** (Recommended) - Easy deploy with environment variables
- **AWS Amplify** - Full AWS integration
- **AWS ECS/Fargate** - Container-based deployment
- **Netlify** - JAMstack deployment

---

## 🎓 **Usage Examples**

### **Adding a Textbook (Admin)**
1. Login to auth hub as admin
2. Go to "Manage Textbooks" tab
3. Click "Add Textbook"
4. Fill in details:
   - **Title**: "Introduction to Physics"
   - **URL**: "https://physics.yourschool.edu"
   - **Status**: "public" (immediate access) or "private" (request-based)
5. Save - textbook is immediately protected and accessible

### **Student Access Flow**
1. Student visits textbook URL directly
2. Gets redirected to auth hub for login
3. After login, sees dashboard with available textbooks
4. Clicks "Open Textbook" → Gets instant access
5. Can read textbook for 24 hours without re-authentication

### **Access Request Process**
1. Student sees private textbook in "Available to Request"
2. Clicks "Request Access"
3. Admin receives notification in "Requests" tab
4. Admin reviews and approves/denies with optional reason
5. Student gets immediate access upon approval

---

## 🛠️ **Technology Stack**

### **Frontend**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **Clerk** - Authentication provider

### **Backend**
- **Next.js API Routes** - Serverless backend functions
- **JWT (jsonwebtoken)** - Token generation and verification
- **Clerk API** - User management and metadata storage
- **Middleware** - Request interception and authentication

### **Security**
- **CORS** - Cross-origin request protection
- **JWT Signatures** - Cryptographic token validation
- **HttpOnly Cookies** - Secure session management
- **Role-Based Access** - Permission matrix implementation

---

## 📖 **Core Concepts**

### **Centralized Metadata Storage**
All textbooks are stored in one "system admin" user's Clerk metadata. This provides:
- **Single source of truth** for all textbook data
- **Consistent view** across all admin accounts
- **Simple querying** without complex database joins
- **Automatic backups** via Clerk's infrastructure

### **Dynamic CORS Management**
The system automatically extracts textbook origins from stored URLs and creates a dynamic CORS whitelist:
```typescript
Stored textbooks: [
  { url: "http://localhost:3001" },
  { url: "http://localhost:3002" }
]
        ↓
Allowed CORS origins: [
  "http://localhost:3001",
  "http://localhost:3002"  
]
```

### **Token Security Model**
Each access token is bound to:
- **Specific user** (prevents sharing)
- **Specific textbook** (prevents cross-textbook access)
- **Time window** (24-hour expiration)
- **Origin domain** (prevents domain spoofing)

### **Permission Preservation**
When textbook status changes, user permissions are preserved:
- **Private → Hidden**: Students lose access temporarily
- **Hidden → Private**: Students regain access (no re-approval needed)
- **Status changes**: Don't affect underlying permission relationships

---

## 🛠️ **Automation Script (`scripts/textbook_protect_setup.py`)**

### **Purpose**
Automatically adds authentication protection to existing Fumadocs textbooks without manual file creation. The script scans your project directory, identifies valid textbook projects, and adds all necessary authentication components.

### **What the Script Does**
1. **🔍 Scans project directory** for Fumadocs textbooks (looks for `app/`, `content/`, `lib/`, `content/docs/` structure)
2. **📋 Lists found textbooks** with protection status
3. **🎯 Interactive selection** - choose which textbooks to protect
4. **🔧 Adds middleware** for token verification and session management
5. **🎨 Creates ProtectedLayout** with auth status bar and logout functionality
6. **📡 Sets up API routes** for session management
7. **⚙️ Configures environment** variables for auth hub communication
8. **🔄 Updates layout.tsx** to include protection wrapper

### **Usage**
```bash
# Run from your main project directory (where textbook folders are located)
python3 scripts/textbook_protect_setup.py

# Interactive prompts:
# 1. Shows detected textbooks
# 2. Select which ones to protect (numbers, 'all', or 'q' to quit)
# 3. Enter auth hub URL (defaults to http://localhost:3000)
# 4. Confirms selection and applies protection

# Example output:
📚 Available Textbooks:
==================================================
1. 🔓 physics-textbook              [❌ Not Protected]
2. 🔓 chemistry-textbook            [❌ Not Protected]  
3. 🔒 math-textbook                 [✅ Protected]

👉 Your selection: 1,2
✅ Selected 2 textbook(s) for protection:
   - physics-textbook
   - chemistry-textbook

🤔 Proceed with protection? (y/n): y
```

### **Files Created/Modified per Textbook**
```bash
your-textbook/
├── middleware.ts                 # ← Created: Authentication middleware
├── components/
│   └── ProtectedLayout.tsx      # ← Created: Auth status bar
├── app/
│   ├── api/auth/logout/
│   │   └── route.ts             # ← Created: Session cleanup
│   └── layout.tsx               # ← Modified: Wrapped with protection
└── .env.local                   # ← Updated: Auth hub URL
```

### **Debug Tools**
- **Extensive logging** in all components
- **Console debugging** for token flows
- **Network tab inspection** for API calls
- **Clerk dashboard** for user metadata inspection

---

## 🏥 **System Health & Monitoring**

### **Built-in Logging**
Every component includes detailed logging:
```typescript
// Middleware
🔍 Middleware called for: /chapter-1
🔑 Access token found in URL, verifying...
✅ Access granted via session cookie

// API Routes  
📚 Found textbook: Physics 101 (public)
🔐 Generated JWT token for user: student@school.edu
✅ CORS allowed for registered textbook: http://localhost:3001
```

### **Key Metrics to Monitor**
- **Token generation rate** - Usage patterns
- **Verification failures** - Security incidents
- **CORS blocks** - Unauthorized access attempts
- **Request approval rate** - Admin responsiveness

---

## 🔒 **Security Considerations**

### **Production Security Checklist**
- ✅ **JWT_SECRET** - Use cryptographically secure 256-bit key
- ✅ **HTTPS Only** - All production textbooks must use HTTPS
- ✅ **Secure Cookies** - HttpOnly, Secure flags in production
- ✅ **CORS Protection** - Dynamic origin whitelisting
- ✅ **Token Expiration** - 24-hour maximum session length
- ✅ **Logout Invalidation** - Complete session cleanup

### **Attack Mitigation**
- **Token Tampering**: JWT signatures make forgery impossible
- **Session Hijacking**: HttpOnly cookies prevent client-side access
- **Cross-Domain Attacks**: Origin validation blocks unauthorized domains
- **Privilege Escalation**: Role checks in every sensitive operation
- **Token Reuse**: Logout timestamps invalidate old tokens

---

## 🎯 **Product Purpose**

This system is specifically designed to **protect educational textbooks** and provide **centralized access management** for educational institutions. It solves the challenge of controlling access to valuable educational content while maintaining a seamless user experience for students and administrators.

### **Core Problems Solved**
- **🔓 Open textbook access** - Unprotected content accessible to anyone
- **👥 User management complexity** - No centralized way to control who can access what
- **🔑 Manual access control** - Time-consuming individual permission management  
- **🌐 Multi-textbook authentication** - Students having to login to each textbook separately
- **🛡️ Security vulnerabilities** - No session invalidation or token reuse prevention

---

---

## 📈 **Performance & Scaling**

### **Current System Capacity**
- **Textbooks**: ~100-500 (Clerk metadata size limits)
- **Students**: ~1000-5000 (API pagination limits)
- **Concurrent Users**: Limited by hosting platform
- **Token Generation**: ~20/second (Clerk rate limits)

### **Scaling Strategies**
- **Database Migration**: Move to PostgreSQL/MongoDB for large deployments
- **Caching Layer**: Redis for frequently accessed data
- **CDN Integration**: CloudFront for static textbook assets
- **Load Balancing**: Multiple auth hub instances

---

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Student Can't Access Textbook**
1. Check textbook status (public/private/hidden)
2. Verify student has permission in metadata
3. Check token expiration and logout timestamp
4. Validate textbook URL is correctly registered

#### **CORS Errors**
1. Verify textbook URL is registered in admin panel
2. Check environment variables in textbook deployment
3. Confirm origin extraction from metadata
4. Validate HTTPS vs HTTP protocol matching

#### **Admin Can't See Textbooks**
1. Confirm user has admin role in Clerk metadata
2. Check if system admin exists (systemData: true)
3. Verify API permissions and error responses
4. Check Clerk API connectivity and rate limits

### **Debug Commands**
```bash
# Check textbook registration
curl localhost:3000/api/textbooks

# Verify user metadata
# (Check in Clerk dashboard under user details)

# Test token generation
curl -X POST localhost:3000/api/access/generate-token \
  -H "Content-Type: application/json" \
  -d '{"textbookId": "tb_123"}'
```

---

**Built for secure educational content delivery and access management** 📚🔐

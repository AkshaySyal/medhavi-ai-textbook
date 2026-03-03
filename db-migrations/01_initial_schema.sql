-- Classes Table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL, -- e.g., "Physics 101"
  instructor_id VARCHAR(255) NOT NULL, -- Clerk User ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

-- Class Textbooks (Many-to-Many: Classes <-> Textbooks)
CREATE TABLE class_textbooks (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  textbook_id VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (class_id, textbook_id)
);

-- Class Enrollments (Many-to-Many: Classes <-> Students)
CREATE TABLE class_enrollments (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id VARCHAR(255) NOT NULL, -- Clerk User ID
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id)
);

-- Class Invites (For Invite Links)
CREATE TABLE class_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g. "PHYS101-JOIN-X7B9"
  created_by VARCHAR(255) NOT NULL, -- Instructor Clerk ID
  allowed_domain VARCHAR(255), -- Optional (e.g., "northeastern.edu")
  max_uses INTEGER, -- Optional (e.g., 50)
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

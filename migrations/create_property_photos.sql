-- Create property_photos table
CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES customer_properties(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  file_size INTEGER,
  photo_type TEXT,
  description TEXT DEFAULT '',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_property_photos_property_id ON property_photos(property_id);
CREATE INDEX idx_property_photos_customer_id ON property_photos(customer_id);
CREATE INDEX idx_property_photos_created_at ON property_photos(created_at DESC);

-- Enable RLS
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for authenticated users"
  ON property_photos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users"
  ON property_photos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for photo owner"
  ON property_photos FOR DELETE
  USING (uploaded_by = auth.uid() OR auth.role() = 'authenticated');

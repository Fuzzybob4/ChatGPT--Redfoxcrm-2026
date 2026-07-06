export type Property = { id: string; name: string; address: string; serviceTypes: string[]; notes?: string }
export type Customer = { id: string; name: string; email: string; phone: string; type: 'Residential' | 'Commercial' | 'Property Manager' | 'HOA'; properties: Property[] }
export type AddOn = { id: string; name: string; description: string; unitPrice: number; unit: string }

export const customers: Customer[] = [
  { id: 'cust-001', name: 'ABC Property Management', email: 'ops@example.com', phone: '(512) 555-0144', type: 'Property Manager', properties: [
    { id: 'prop-001', name: 'HOA Entrance 1', address: '101 Fox Ridge Dr', serviceTypes: ['Holiday Lighting', 'Wreaths'], notes: 'Gate code on file' },
    { id: 'prop-002', name: 'Clubhouse', address: '200 Fox Ridge Dr', serviceTypes: ['Roofline', 'Tree Lighting', 'Pathway Lights'] }
  ]},
  { id: 'cust-002', name: 'Sarah Johnson', email: 'sarah@example.com', phone: '(512) 555-0188', type: 'Residential', properties: [
    { id: 'prop-003', name: 'Primary Residence', address: '88 Live Oak Trail', serviceTypes: ['Holiday Lighting'] }
  ]}
]

export const addOns: AddOn[] = [
  { id: 'addon-wreath', name: 'Wreath', description: 'Pre-lit wreath installed on front elevation or gate.', unitPrice: 150, unit: 'each' },
  { id: 'addon-tree', name: 'Tree Lighting', description: 'Wrapped mini lights on trunk and branches.', unitPrice: 350, unit: 'tree' },
  { id: 'addon-pathway', name: 'Pathway Lights', description: 'Ground stake pathway lighting.', unitPrice: 18, unit: 'linear ft' },
  { id: 'addon-garland', name: 'Garland', description: 'Pre-lit garland for railings, doors, or entries.', unitPrice: 12, unit: 'linear ft' }
]

export const jobs = [
  { id: 'job-001', customer: 'ABC Property Management', property: 'HOA Entrance 1', date: 'Nov 4', status: 'Scheduled', crew: 'Crew A', value: 2450 },
  { id: 'job-002', customer: 'Sarah Johnson', property: 'Primary Residence', date: 'Nov 5', status: 'Estimate Sent', crew: 'Unassigned', value: 1850 }
]

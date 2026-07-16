'use client';

import { useState } from 'react';
import { Home, FileText, Wrench, AlertCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CustomerPortalInvoices } from './customer-portal-invoices';
import { CustomerPortalWorkOrders } from './customer-portal-work-orders';
import { CustomerPortalTickets } from './customer-portal-tickets';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  org_id: string;
}

interface CustomerPortalClientProps {
  customer: Customer;
  token: string;
}

type Tab = 'dashboard' | 'invoices' | 'work-orders' | 'tickets';

export function CustomerPortalClient({ customer, token }: CustomerPortalClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const handleLogout = () => {
    // Clear any session data and redirect
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customer Portal</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {customer.first_name} {customer.last_name}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Exit Portal
          </Button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b bg-muted/50">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invoices'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('work-orders')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'work-orders'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Work Orders
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tickets'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Support Tickets
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Welcome to Your Portal</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <div className="text-sm text-muted-foreground mb-2">Open Invoices</div>
                  <div className="text-2xl font-bold">0</div>
                </Card>
                <Card className="p-6">
                  <div className="text-sm text-muted-foreground mb-2">Pending Work Orders</div>
                  <div className="text-2xl font-bold">0</div>
                </Card>
                <Card className="p-6">
                  <div className="text-sm text-muted-foreground mb-2">Open Support Tickets</div>
                  <div className="text-2xl font-bold">0</div>
                </Card>
              </div>
            </div>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  onClick={() => setActiveTab('invoices')}
                  variant="outline"
                  className="justify-start"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Invoices
                </Button>
                <Button
                  onClick={() => setActiveTab('work-orders')}
                  variant="outline"
                  className="justify-start"
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Request Work Order
                </Button>
                <Button
                  onClick={() => setActiveTab('tickets')}
                  variant="outline"
                  className="justify-start"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Submit Support Ticket
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'invoices' && <CustomerPortalInvoices customerId={customer.id} />}

        {activeTab === 'work-orders' && (
          <CustomerPortalWorkOrders customerId={customer.id} token={token} />
        )}

        {activeTab === 'tickets' && (
          <CustomerPortalTickets customerId={customer.id} token={token} />
        )}
      </main>
    </div>
  );
}

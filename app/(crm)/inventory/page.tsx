import { PageHeader } from '@/components/page-header';
import { getInventoryOverview } from './actions';
import { InventoryClient } from './inventory-client';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const { products, suppliers, alerts, purchaseOrders } = await getInventoryOverview();

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Inventory Management"
        description="Track lights, hardware, and supplies across jobs and suppliers."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <InventoryClient
            products={products}
            suppliers={suppliers}
            alerts={alerts}
            purchaseOrders={purchaseOrders}
          />
        </div>
      </div>
    </div>
  );
}

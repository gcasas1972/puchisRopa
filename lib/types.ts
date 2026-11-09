export type CatalogVariant = {
  id: string;
  size: string;
  stock: number;
  isActive: boolean;
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  variants: CatalogVariant[];
};

export type OrderItemView = {
  id: string;
  orderId: string;
  variantId: string;
  productName: string;
  size: string;
  unitPrice: number;
  quantity: number;
};

export type OrderView = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  total: number;
  createdAt: string | Date;
  items: OrderItemView[];
};

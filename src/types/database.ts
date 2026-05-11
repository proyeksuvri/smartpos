export type UserRole = 'cashier' | 'manager' | 'owner'

export interface Profile {
  id: string
  role: UserRole
  name: string
  pin_hash: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  category_id: string | null
  price_retail: number
  price_wholesale: number
  wholesale_min_qty: number
  cost_price: number
  stock_qty: number
  min_stock: number
  unit: string
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  categories?: Pick<Category, 'id' | 'name'> | null
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'categories'>
export type ProductUpdate = Partial<ProductInsert>

/** Unit partai produk (pak, karton, dos, karung, dll.) */
export interface ProductUnit {
  id:                string
  product_id:        string
  unit_name:         string
  /** Berapa unit dasar per 1 unit ini (mis. 10 pcs per pak) */
  conversion_factor: number
  /** Harga per unit ini — otomatis = price_wholesale × conversion_factor */
  price:             number
  sort_order:        number
  created_at:        string
}

export type ProductUnitInsert = Omit<ProductUnit, 'id' | 'created_at'>
export type ProductUnitUpdate = Partial<ProductUnitInsert>


export interface Customer {
  id: string
  name: string
  phone: string | null
  type: 'retail' | 'wholesale'
  address: string | null
  credit_limit: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at'>
export type CustomerUpdate = Partial<CustomerInsert>

export interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type SupplierInsert = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>
export type SupplierUpdate = Partial<SupplierInsert>

export type CategoryInsert = Omit<Category, 'id' | 'created_at' | 'updated_at'>
export type CategoryUpdate = Partial<CategoryInsert>

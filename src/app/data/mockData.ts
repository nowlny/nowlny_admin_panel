export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable: boolean;
  category: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone: string;
  cuisine: string;
  rating: number;
  reviewsCount: number;
  status: 'Active' | 'Pending' | 'Suspended';
  logo: string;
  banner: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryFee: number;
  deliveryTime: string;
  revenue: number;
  ordersCount: number;
  joinedDate: string;
  documentUrl?: string;
  menu: MenuCategory[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  status: 'Active' | 'Suspended';
  joinedDate: string;
  totalSpent: number;
  ordersCount: number;
  addresses: string[];
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  restaurantId: string;
  restaurantName: string;
  driverId?: string;
  driverName?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  status: 'Pending' | 'Accepted' | 'Preparing' | 'OutForDelivery' | 'Delivered' | 'Cancelled';
  paymentMethod: 'Cash' | 'Card';
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded';
  createdAt: string;
  notes?: string;
  timeline: {
    status: string;
    timestamp: string;
    note?: string;
  }[];
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  status: 'Online' | 'Offline' | 'Suspended';
  vehicleType: 'Car' | 'Scooter' | 'Bicycle';
  vehiclePlate?: string;
  rating: number;
  earnings: number;
  deliveriesCount: number;
  latitude: number;
  longitude: number;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  joinedDate: string;
}

export interface PromoCode {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  expiresAt: string;
  isActive: boolean;
  usedCount: number;
  maxUses?: number;
}

export interface SystemSettings {
  commissionRate: number;
  baseDeliveryFee: number;
  driverShare: number;
  serviceFee: number;
  maintenanceMode: boolean;
  operationalRadius: number;
}

export interface SystemNotification {
  id: string;
  title: string;
  body: string;
  recipientType: 'all' | 'customers' | 'restaurants' | 'drivers';
  timestamp: string;
  read: boolean;
}

// Initial seed data
const initialRestaurants: Restaurant[] = [
  {
    id: "rest-1",
    name: "Burger Nation",
    email: "partner@burgernation.com",
    phone: "+961 71 123 456",
    cuisine: "Burgers, Fast Food",
    rating: 4.8,
    reviewsCount: 342,
    status: "Active",
    logo: "🍔",
    banner: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
    address: "Hamra Main Street, Beirut",
    latitude: 33.8967,
    longitude: 35.4839,
    deliveryFee: 1.99,
    deliveryTime: "25-35 min",
    revenue: 12450.80,
    ordersCount: 412,
    joinedDate: "2025-10-12",
    documentUrl: "/docs/rest-1-license.pdf",
    menu: [
      {
        id: "cat-1-1",
        name: "Burgers",
        items: [
          { id: "item-1-1", name: "Classic Beef Burger", description: "Flame-grilled beef patty, cheddar, lettuce, tomato, special sauce", price: 8.50, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Burgers" },
          { id: "item-1-2", name: "Double Cheese & Bacon", description: "Two beef patties, double cheddar, crispy bacon, BBQ sauce, caramelized onions", price: 11.90, image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Burgers" },
          { id: "item-1-3", name: "Spicy Crispy Chicken", description: "Crispy chicken breast, spicy mayo, pepper jack cheese, jalapeños, slaw", price: 9.20, image: "https://images.unsplash.com/photo-1627662236973-4f8259fa2441?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Burgers" }
        ]
      },
      {
        id: "cat-1-2",
        name: "Sides",
        items: [
          { id: "item-1-4", name: "Crispy French Fries", description: "Golden, salted classic French fries", price: 3.00, image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Sides" },
          { id: "item-1-5", name: "Loaded Cheese Fries", description: "Fries topped with melted cheddar cheese sauce, bacon bits, and chopped jalapeños", price: 5.50, image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Sides" }
        ]
      },
      {
        id: "cat-1-3",
        name: "Beverages",
        items: [
          { id: "item-1-6", name: "Soft Drink", description: "Chilled Coca-Cola, Sprite, or Fanta", price: 1.50, image: "", isAvailable: true, category: "Beverages" },
          { id: "item-1-7", name: "Fresh Lemonade", description: "Freshly squeezed lemons with mint leaves", price: 2.80, image: "", isAvailable: true, category: "Beverages" }
        ]
      }
    ]
  },
  {
    id: "rest-2",
    name: "Pizzeria Bella",
    email: "bellapizza@gmail.com",
    phone: "+961 70 987 654",
    cuisine: "Italian, Pizza",
    rating: 4.6,
    reviewsCount: 218,
    status: "Active",
    logo: "🍕",
    banner: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
    address: "Mar Mikhael Sector, Beirut",
    latitude: 33.8973,
    longitude: 35.5186,
    deliveryFee: 2.49,
    deliveryTime: "30-40 min",
    revenue: 9820.00,
    ordersCount: 310,
    joinedDate: "2025-11-01",
    menu: [
      {
        id: "cat-2-1",
        name: "Pizzas",
        items: [
          { id: "item-2-1", name: "Margherita Pizza", description: "Tomato sauce, fresh mozzarella, fresh basil, extra virgin olive oil", price: 9.00, image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Pizzas" },
          { id: "item-2-2", name: "Pepperoni Passion", description: "Double pepperoni, tomato sauce, mozzarella, oregano", price: 11.50, image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Pizzas" },
          { id: "item-2-3", name: "Truffle Mushroom Pizza", description: "White truffle sauce, wild mushrooms, fresh mozzarella, wild rocket", price: 14.00, image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Pizzas" }
        ]
      },
      {
        id: "cat-2-2",
        name: "Salads & Starters",
        items: [
          { id: "item-2-4", name: "Caprese Salad", description: "Slices of fresh mozzarella and vine-ripened tomatoes, fresh basil, balsamic glaze", price: 7.00, image: "", isAvailable: true, category: "Salads & Starters" },
          { id: "item-2-5", name: "Garlic Bread with Cheese", description: "Toasted artisan bread with garlic butter and melted mozzarella", price: 4.50, image: "", isAvailable: true, category: "Salads & Starters" }
        ]
      }
    ]
  },
  {
    id: "rest-3",
    name: "Al-Sultan Grill",
    email: "alsultan@grill.com",
    phone: "+961 76 543 210",
    cuisine: "Middle Eastern, Grills",
    rating: 4.7,
    reviewsCount: 512,
    status: "Active",
    logo: "🍢",
    banner: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    address: "Verdun Commercial District, Beirut",
    latitude: 33.8865,
    longitude: 35.4852,
    deliveryFee: 1.50,
    deliveryTime: "20-30 min",
    revenue: 18940.50,
    ordersCount: 689,
    joinedDate: "2025-09-05",
    menu: [
      {
        id: "cat-3-1",
        name: "Platters",
        items: [
          { id: "item-3-1", name: "Mixed Grill Platter", description: "Skewers of Shish Taouk, Beef Kabab, and Kafta. Served with garlic paste, hummus, and grilled vegetables", price: 16.50, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Platters" },
          { id: "item-3-2", name: "Shish Taouk Platter", description: "Marinated cubes of grilled chicken breast served with fries and signature garlic sauce", price: 11.50, image: "", isAvailable: true, category: "Platters" }
        ]
      },
      {
        id: "cat-3-2",
        name: "Cold & Hot Mezza",
        items: [
          { id: "item-3-3", name: "Hummus Beiruty", description: "Blend of chickpeas, tahini, lemon juice, parsley, and garlic, topped with olive oil", price: 4.00, image: "https://images.unsplash.com/photo-1637949385162-e416fb15b2ce?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Cold & Hot Mezza" },
          { id: "item-3-4", name: "Tabbouleh", description: "Traditional chopped parsley, tomatoes, mint, onions, fine bulgur, olive oil and lemon dressing", price: 4.50, image: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Cold & Hot Mezza" },
          { id: "item-3-5", name: "Hot Meat Sambousek (4 pcs)", description: "Crispy fried pastry filled with seasoned minced meat and pine nuts", price: 4.20, image: "", isAvailable: true, category: "Cold & Hot Mezza" }
        ]
      }
    ]
  },
  {
    id: "rest-4",
    name: "Sushi Zen",
    email: "contact@sushizen.com",
    phone: "+961 03 111 222",
    cuisine: "Japanese, Sushi",
    rating: 4.9,
    reviewsCount: 154,
    status: "Active",
    logo: "🍣",
    banner: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80",
    address: "Achrafieh, Sursock Area, Beirut",
    latitude: 33.8928,
    longitude: 35.5132,
    deliveryFee: 3.99,
    deliveryTime: "35-50 min",
    revenue: 8120.00,
    ordersCount: 145,
    joinedDate: "2026-01-20",
    menu: [
      {
        id: "cat-4-1",
        name: "Sushi Combos",
        items: [
          { id: "item-4-1", name: "Zen Combo (16 pcs)", description: "4 Crispy Crazy, 4 Special California, 4 Spicy Salmon, 4 Naked Salmon Maki", price: 21.00, image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Sushi Combos" },
          { id: "item-4-2", name: "Premium Sashimi Set (10 pcs)", description: "Fresh slices of Salmon, Tuna, and Crab sashimi", price: 18.50, image: "", isAvailable: true, category: "Sushi Combos" }
        ]
      }
    ]
  },
  {
    id: "rest-5",
    name: "Crust & Crumb Bakery",
    email: "crustandcrumb@bakery.com",
    phone: "+961 71 888 999",
    cuisine: "Bakery, Pastries, Coffee",
    rating: 4.5,
    reviewsCount: 88,
    status: "Pending",
    logo: "🥐",
    banner: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
    address: "Badaro Street, Beirut",
    latitude: 33.8781,
    longitude: 35.5139,
    deliveryFee: 2.00,
    deliveryTime: "15-25 min",
    revenue: 0.00,
    ordersCount: 0,
    joinedDate: "2026-05-15",
    documentUrl: "/docs/crust_license.pdf",
    menu: [
      {
        id: "cat-5-1",
        name: "Croissants",
        items: [
          { id: "item-5-1", name: "Butter Croissant", description: "Flaky, buttery classic French croissant", price: 2.50, image: "", isAvailable: true, category: "Croissants" },
          { id: "item-5-2", name: "Almond Croissant", description: "Filled with sweet almond frangipane paste and topped with sliced almonds", price: 3.50, image: "", isAvailable: true, category: "Croissants" }
        ]
      }
    ]
  },
  {
    id: "rest-6",
    name: "Taco Loco",
    email: "tacos@loco.com",
    phone: "+961 70 234 567",
    cuisine: "Mexican, Tacos",
    rating: 4.4,
    reviewsCount: 112,
    status: "Suspended",
    logo: "🌮",
    banner: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80",
    address: "Gemmayze Main Road, Beirut",
    latitude: 33.8969,
    longitude: 35.5109,
    deliveryFee: 2.50,
    deliveryTime: "25-35 min",
    revenue: 4120.00,
    ordersCount: 180,
    joinedDate: "2025-08-10",
    menu: [
      {
        id: "cat-6-1",
        name: "Tacos",
        items: [
          { id: "item-6-1", name: "Birria Beef Tacos (3 pcs)", description: "Slow-cooked beef, melted cheese, onions, cilantro, served with a side of rich dipping broth", price: 10.00, image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&auto=format&fit=crop&q=80", isAvailable: true, category: "Tacos" }
        ]
      }
    ]
  }
];

const initialCustomers: Customer[] = [
  {
    id: "cust-1",
    name: "Karim Harfoush",
    email: "karim@harfoush.me",
    phone: "+961 71 889 001",
    avatar: "👨‍💻",
    status: "Active",
    joinedDate: "2025-05-18",
    totalSpent: 420.50,
    ordersCount: 24,
    addresses: [
      "Bldg 12, Floor 3, Hamra Main Street, Beirut",
      "Office 504, 5th Floor, Verdun Towers, Beirut"
    ]
  },
  {
    id: "cust-2",
    name: "Sarah Ghandour",
    email: "sarah.ghandour@outlook.com",
    phone: "+961 70 456 789",
    avatar: "👩‍⚕️",
    status: "Active",
    joinedDate: "2025-07-22",
    totalSpent: 852.10,
    ordersCount: 42,
    addresses: [
      "Ghandour Villa, Sursock Sector, Achrafieh, Beirut"
    ]
  },
  {
    id: "cust-3",
    name: "Rayan Al-Sabeh",
    email: "rayan@alsabeh.org",
    phone: "+961 03 998 877",
    avatar: "🧑‍🎨",
    status: "Active",
    joinedDate: "2025-11-10",
    totalSpent: 120.40,
    ordersCount: 6,
    addresses: [
      "Block B, Floor 2, Badaro Street, Beirut"
    ]
  },
  {
    id: "cust-4",
    name: "Maya Khoury",
    email: "maya.khoury@gmail.com",
    phone: "+961 76 112 233",
    avatar: "👩‍💼",
    status: "Suspended",
    joinedDate: "2025-03-01",
    totalSpent: 310.00,
    ordersCount: 15,
    addresses: [
      "Floor 1, Khoury Building, Mar Mikhael, Beirut"
    ]
  }
];

const initialDrivers: Driver[] = [
  {
    id: "drv-1",
    name: "Ali Nehme",
    email: "ali.nehme@nowlny-delivery.com",
    phone: "+961 71 555 444",
    avatar: "🛵",
    status: "Online",
    vehicleType: "Scooter",
    vehiclePlate: "M-48901",
    rating: 4.9,
    earnings: 890.50,
    deliveriesCount: 124,
    latitude: 33.8962,
    longitude: 35.4859,
    verificationStatus: "Verified",
    joinedDate: "2025-06-15"
  },
  {
    id: "drv-2",
    name: "Tarek Sleiman",
    email: "tarek@nowlny-delivery.com",
    phone: "+961 70 777 888",
    avatar: "🚗",
    status: "Online",
    vehicleType: "Car",
    vehiclePlate: "B-23910",
    rating: 4.7,
    earnings: 1420.00,
    deliveriesCount: 182,
    latitude: 33.8912,
    longitude: 35.5190,
    verificationStatus: "Verified",
    joinedDate: "2025-08-01"
  },
  {
    id: "drv-3",
    name: "Jihad Saab",
    email: "jihad.saab@gmail.com",
    phone: "+961 76 333 222",
    avatar: "🚴",
    status: "Offline",
    vehicleType: "Bicycle",
    rating: 4.8,
    earnings: 320.00,
    deliveriesCount: 48,
    latitude: 33.8821,
    longitude: 35.4981,
    verificationStatus: "Verified",
    joinedDate: "2025-10-18"
  },
  {
    id: "drv-4",
    name: "Rony Daou",
    email: "rony.daou@gmail.com",
    phone: "+961 03 666 555",
    avatar: "🛵",
    status: "Offline",
    vehicleType: "Scooter",
    rating: 0.0,
    earnings: 0.00,
    deliveriesCount: 0,
    latitude: 33.8950,
    longitude: 35.4910,
    verificationStatus: "Pending",
    joinedDate: "2026-05-16"
  }
];

const initialOrders: Order[] = [
  {
    id: "ORD-9821",
    customerId: "cust-1",
    customerName: "Karim Harfoush",
    restaurantId: "rest-1",
    restaurantName: "Burger Nation",
    driverId: "drv-1",
    driverName: "Ali Nehme",
    items: [
      { id: "item-1-2", name: "Double Cheese & Bacon", price: 11.90, quantity: 2 },
      { id: "item-1-5", name: "Loaded Cheese Fries", price: 5.50, quantity: 1 },
      { id: "item-1-6", name: "Soft Drink", price: 1.50, quantity: 2 }
    ],
    subtotal: 32.30,
    deliveryFee: 1.99,
    serviceFee: 1.00,
    discount: 5.00,
    total: 30.29,
    status: "OutForDelivery",
    paymentMethod: "Cash",
    paymentStatus: "Pending",
    createdAt: "2026-05-18T08:12:00+03:00",
    notes: "Please call on arrival, baby is sleeping.",
    timeline: [
      { status: "Created", timestamp: "2026-05-18T08:12:00+03:00", note: "Order placed by customer." },
      { status: "Accepted", timestamp: "2026-05-18T08:15:00+03:00", note: "Accepted by Burger Nation." },
      { status: "Preparing", timestamp: "2026-05-18T08:16:30+03:00", note: "Food is being prepared." },
      { status: "DriverAssigned", timestamp: "2026-05-18T08:25:00+03:00", note: "Driver Ali Nehme assigned." },
      { status: "OutForDelivery", timestamp: "2026-05-18T08:35:00+03:00", note: "Driver picked up and is out for delivery." }
    ]
  },
  {
    id: "ORD-9822",
    customerId: "cust-2",
    customerName: "Sarah Ghandour",
    restaurantId: "rest-2",
    restaurantName: "Pizzeria Bella",
    driverId: "drv-2",
    driverName: "Tarek Sleiman",
    items: [
      { id: "item-2-2", name: "Pepperoni Passion", price: 11.50, quantity: 1 },
      { id: "item-2-3", name: "Truffle Mushroom Pizza", price: 14.00, quantity: 1 },
      { id: "item-2-5", name: "Garlic Bread with Cheese", price: 4.50, quantity: 1 }
    ],
    subtotal: 30.00,
    deliveryFee: 2.49,
    serviceFee: 1.00,
    discount: 0.00,
    total: 33.49,
    status: "Preparing",
    paymentMethod: "Card",
    paymentStatus: "Paid",
    createdAt: "2026-05-18T08:28:00+03:00",
    notes: "Leave at front gate with security guard.",
    timeline: [
      { status: "Created", timestamp: "2026-05-18T08:28:00+03:00", note: "Order paid via Card." },
      { status: "Accepted", timestamp: "2026-05-18T08:31:00+03:00", note: "Accepted by Pizzeria Bella." },
      { status: "Preparing", timestamp: "2026-05-18T08:32:00+03:00", note: "Chef is baking the pizzas." }
    ]
  },
  {
    id: "ORD-9823",
    customerId: "cust-3",
    customerName: "Rayan Al-Sabeh",
    restaurantId: "rest-3",
    restaurantName: "Al-Sultan Grill",
    items: [
      { id: "item-3-1", name: "Mixed Grill Platter", price: 16.50, quantity: 1 },
      { id: "item-3-3", name: "Hummus Beiruty", price: 4.00, quantity: 1 },
      { id: "item-3-4", name: "Tabbouleh", price: 4.50, quantity: 1 }
    ],
    subtotal: 25.00,
    deliveryFee: 1.50,
    serviceFee: 1.00,
    discount: 0.00,
    total: 27.50,
    status: "Pending",
    paymentMethod: "Cash",
    paymentStatus: "Pending",
    createdAt: "2026-05-18T08:38:00+03:00",
    timeline: [
      { status: "Created", timestamp: "2026-05-18T08:38:00+03:00", note: "Pending approval." }
    ]
  },
  {
    id: "ORD-9818",
    customerId: "cust-1",
    customerName: "Karim Harfoush",
    restaurantId: "rest-2",
    restaurantName: "Pizzeria Bella",
    driverId: "drv-1",
    driverName: "Ali Nehme",
    items: [
      { id: "item-2-1", name: "Margherita Pizza", price: 9.00, quantity: 1 }
    ],
    subtotal: 9.00,
    deliveryFee: 2.49,
    serviceFee: 1.00,
    discount: 0.00,
    total: 12.49,
    status: "Delivered",
    paymentMethod: "Card",
    paymentStatus: "Paid",
    createdAt: "2026-05-17T20:15:00+03:00",
    timeline: [
      { status: "Created", timestamp: "2026-05-17T20:15:00+03:00" },
      { status: "Accepted", timestamp: "2026-05-17T20:18:00+03:00" },
      { status: "Preparing", timestamp: "2026-05-17T20:20:00+03:00" },
      { status: "OutForDelivery", timestamp: "2026-05-17T20:38:00+03:00" },
      { status: "Delivered", timestamp: "2026-05-17T20:52:00+03:00", note: "Delivered on time." }
    ]
  },
  {
    id: "ORD-9819",
    customerId: "cust-2",
    customerName: "Sarah Ghandour",
    restaurantId: "rest-3",
    restaurantName: "Al-Sultan Grill",
    driverId: "drv-2",
    driverName: "Tarek Sleiman",
    items: [
      { id: "item-3-1", name: "Mixed Grill Platter", price: 16.50, quantity: 2 },
      { id: "item-3-5", name: "Hot Meat Sambousek (4 pcs)", price: 4.20, quantity: 2 }
    ],
    subtotal: 41.40,
    deliveryFee: 1.50,
    serviceFee: 1.00,
    discount: 10.00,
    total: 33.90,
    status: "Delivered",
    paymentMethod: "Cash",
    paymentStatus: "Paid",
    createdAt: "2026-05-17T14:30:00+03:00",
    timeline: [
      { status: "Created", timestamp: "2026-05-17T14:30:00+03:00" },
      { status: "Accepted", timestamp: "2026-05-17T14:32:00+03:00" },
      { status: "Preparing", timestamp: "2026-05-17T14:35:00+03:00" },
      { status: "OutForDelivery", timestamp: "2026-05-17T14:55:00+03:00" },
      { status: "Delivered", timestamp: "2026-05-17T15:15:00+03:00" }
    ]
  },
  {
    id: "ORD-9820",
    customerId: "cust-4",
    customerName: "Maya Khoury",
    restaurantId: "rest-1",
    restaurantName: "Burger Nation",
    items: [
      { id: "item-1-1", name: "Classic Beef Burger", price: 8.50, quantity: 1 }
    ],
    subtotal: 8.50,
    deliveryFee: 1.99,
    serviceFee: 1.00,
    discount: 0.00,
    total: 11.49,
    status: "Cancelled",
    paymentMethod: "Cash",
    paymentStatus: "Refunded",
    createdAt: "2026-05-17T11:45:00+03:00",
    notes: "Customer cancelled due to incorrect address.",
    timeline: [
      { status: "Created", timestamp: "2026-05-17T11:45:00+03:00" },
      { status: "Cancelled", timestamp: "2026-05-17T11:48:00+03:00", note: "Cancelled by Admin: customer request." }
    ]
  }
];

const initialPromoCodes: PromoCode[] = [
  { code: "NOWLNY20", discountType: "percentage", discountValue: 20, minOrderValue: 15.00, expiresAt: "2026-06-30", isActive: true, usedCount: 142, maxUses: 500 },
  { code: "FREE5", discountType: "fixed", discountValue: 5.00, minOrderValue: 20.00, expiresAt: "2026-05-31", isActive: true, usedCount: 88 },
  { code: "WELCOME6", discountType: "fixed", discountValue: 6.00, minOrderValue: 12.00, expiresAt: "2026-12-31", isActive: true, usedCount: 231, maxUses: 1000 },
  { code: "BURGERFEST", discountType: "percentage", discountValue: 15, minOrderValue: 10.00, expiresAt: "2026-05-15", isActive: false, usedCount: 50, maxUses: 50 }
];

const initialSettings: SystemSettings = {
  commissionRate: 15.0, // 15% platform commission on order subtotal
  baseDeliveryFee: 2.00, // $2.00 base delivery fee
  driverShare: 80.0, // 80% of delivery fee goes to the driver
  serviceFee: 1.00, // $1.00 platform service fee
  maintenanceMode: false,
  operationalRadius: 15 // 15 km operating radius
};

const initialNotifications: SystemNotification[] = [
  {
    id: "notif-1",
    title: "System Update v1.4",
    body: "The driver mobile app now supports offline mapping cached routes.",
    recipientType: "drivers",
    timestamp: "2026-05-17T18:00:00+03:00",
    read: true
  },
  {
    id: "notif-2",
    title: "Ramadan Food Festival Campaign",
    body: "Join our upcoming food festival campaign. Offer 20% discount on grids to get featured on the main banners!",
    recipientType: "restaurants",
    timestamp: "2026-05-16T12:00:00+03:00",
    read: false
  }
];

// LocalStorage helpers to simulate database operations in an SPA environment
export const getStoredData = <T>(key: string, seed: T): T => {
  if (typeof window === 'undefined') return seed;
  try {
    const storage = window.localStorage;
    if (!storage) return seed;
    const raw = storage.getItem(key);
    if (!raw) {
      try {
        storage.setItem(key, JSON.stringify(seed));
      } catch (writeErr) {
        console.warn(`localStorage setItem failed for key "${key}":`, writeErr);
      }
      return seed;
    }
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`localStorage read failed for key "${key}":`, e);
    return seed;
  }
};

export const setStoredData = <T>(key: string, data: T): void => {
  if (typeof window !== 'undefined') {
    try {
      const storage = window.localStorage;
      if (storage) {
        storage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      console.warn(`localStorage save failed for key "${key}":`, e);
    }
  }
};

export const loadDb = () => {
  return {
    restaurants: getStoredData<Restaurant[]>("nowlny_restaurants", initialRestaurants),
    customers: getStoredData<Customer[]>("nowlny_customers", initialCustomers),
    drivers: getStoredData<Driver[]>("nowlny_drivers", initialDrivers),
    orders: getStoredData<Order[]>("nowlny_orders", initialOrders),
    promos: getStoredData<PromoCode[]>("nowlny_promos", initialPromoCodes),
    settings: getStoredData<SystemSettings>("nowlny_settings", initialSettings),
    notifications: getStoredData<SystemNotification[]>("nowlny_notifications", initialNotifications)
  };
};

export const saveDb = (db: ReturnType<typeof loadDb>) => {
  setStoredData("nowlny_restaurants", db.restaurants);
  setStoredData("nowlny_customers", db.customers);
  setStoredData("nowlny_drivers", db.drivers);
  setStoredData("nowlny_orders", db.orders);
  setStoredData("nowlny_promos", db.promos);
  setStoredData("nowlny_settings", db.settings);
  setStoredData("nowlny_notifications", db.notifications);
};

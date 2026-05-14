import { UserAccount } from '../models/user-account.model';

export const EMPLOYEE_SEED_ACCOUNTS: UserAccount[] = [
  {
    id: 'emp-001',
    fullName: 'Nguyen Thi Anh',
    email: 'anh.nguyen@shop.local',
    username: 'anh.nguyen',
    role: 'STAFF',
    active: true,
    ordersToday: 7,
    ordersThisMonth: 84,
    handledOrders: [
      {
        orderCode: 'ORD-260412-001',
        customerName: 'Tran Minh Chau',
        status: 'PROCESSING',
        handledAt: '2026-04-12T08:10:00Z'
      },
      {
        orderCode: 'ORD-260412-013',
        customerName: 'Le Quoc Dat',
        status: 'SHIPPED',
        handledAt: '2026-04-12T10:22:00Z'
      },
      {
        orderCode: 'ORD-260411-088',
        customerName: 'Pham Thanh Ha',
        status: 'COMPLETED',
        handledAt: '2026-04-11T16:45:00Z'
      }
    ]
  },
  {
    id: 'emp-002',
    fullName: 'Tran Hong Son',
    email: 'son.tran@shop.local',
    username: 'son.tran',
    role: 'STAFF',
    active: true,
    ordersToday: 5,
    ordersThisMonth: 63,
    handledOrders: [
      {
        orderCode: 'ORD-260412-007',
        customerName: 'Do Gia Linh',
        status: 'PROCESSING',
        handledAt: '2026-04-12T09:02:00Z'
      },
      {
        orderCode: 'ORD-260412-018',
        customerName: 'Hoang Van Khanh',
        status: 'SHIPPED',
        handledAt: '2026-04-12T11:03:00Z'
      },
      {
        orderCode: 'ORD-260410-074',
        customerName: 'Bui Thi Yen',
        status: 'COMPLETED',
        handledAt: '2026-04-10T15:16:00Z'
      }
    ]
  },
  {
    id: 'emp-003',
    fullName: 'Le Minh Quang',
    email: 'quang.le@shop.local',
    username: 'quang.le',
    role: 'ADMIN',
    active: true,
    ordersToday: 3,
    ordersThisMonth: 41,
    handledOrders: [
      {
        orderCode: 'ORD-260412-020',
        customerName: 'Ngo Thu Trang',
        status: 'NEW',
        handledAt: '2026-04-12T11:20:00Z'
      },
      {
        orderCode: 'ORD-260409-052',
        customerName: 'Phan Tuan Anh',
        status: 'COMPLETED',
        handledAt: '2026-04-09T14:30:00Z'
      }
    ]
  },
  {
    id: 'emp-004',
    fullName: 'Pham Thanh Mai',
    email: 'mai.pham@shop.local',
    username: 'mai.pham',
    role: 'STAFF',
    active: false,
    ordersToday: 0,
    ordersThisMonth: 26,
    handledOrders: [
      {
        orderCode: 'ORD-260404-021',
        customerName: 'Vu Duy Kien',
        status: 'COMPLETED',
        handledAt: '2026-04-04T13:05:00Z'
      },
      {
        orderCode: 'ORD-260403-015',
        customerName: 'Nguyen Anh Thu',
        status: 'CANCELLED',
        handledAt: '2026-04-03T17:38:00Z'
      }
    ]
  },
  {
    id: 'emp-005',
    fullName: 'Doan Gia Huy',
    email: 'huy.doan@shop.local',
    username: 'huy.doan',
    role: 'STAFF',
    active: true,
    ordersToday: 6,
    ordersThisMonth: 71,
    handledOrders: [
      {
        orderCode: 'ORD-260412-024',
        customerName: 'Trinh Bao Ngoc',
        status: 'PROCESSING',
        handledAt: '2026-04-12T11:45:00Z'
      },
      {
        orderCode: 'ORD-260412-026',
        customerName: 'Dang Thanh Nhan',
        status: 'SHIPPED',
        handledAt: '2026-04-12T12:14:00Z'
      },
      {
        orderCode: 'ORD-260408-061',
        customerName: 'Luong Thi Uyen',
        status: 'COMPLETED',
        handledAt: '2026-04-08T16:02:00Z'
      }
    ]
  }
];

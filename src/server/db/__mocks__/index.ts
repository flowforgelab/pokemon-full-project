export const prisma = {
  deck: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  deckCard: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  card: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  set: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  userPreferences: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  notificationPreferences: {
    upsert: jest.fn(),
  },
  privacySettings: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => {
    return callback(prisma);
  }),
};
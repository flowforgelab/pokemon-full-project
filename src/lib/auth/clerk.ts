import { auth } from '@clerk/nextjs/server';

export async function getAuth() {
  return auth();
}

export async function getUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
}
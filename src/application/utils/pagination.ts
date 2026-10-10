import { z } from 'zod';

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(data: T[], page: number, limit: number, total: number) {
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export const money = (value: number) => Math.round(value * 100) / 100;

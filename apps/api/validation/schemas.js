/**
 * Zod validation schemas for request bodies
 */

const { z } = require('zod');

// Helper: trim and lowercase string
const trimmedString = z.string().trim();
const trimmedEmail = trimmedString.email().toLowerCase();
const trimmedLowerString = z.string().trim().toLowerCase();

// Auth schemas
const registerSchema = z.object({
  email: trimmedEmail.min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: trimmedEmail.min(1, 'Email is required'),
  password: trimmedString.min(1, 'Password is required')
});

// Bookmark schemas
const bookmarkCreateSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL is too long')
    .refine(val => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL must use http or https protocol'),
  title: z.string().max(500, 'Title too long').optional().transform(val => val || null),
  description: z.string().max(2000, 'Description too long').optional().transform(val => val || null),
  tags: z.array(trimmedLowerString).optional().default([])
});

const bookmarkUpdateSchema = z.object({
  title: z.string().max(500, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  tags: z.array(trimmedLowerString).optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  bookmarkCreateSchema,
  bookmarkUpdateSchema
};

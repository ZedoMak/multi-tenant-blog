// src/routes/blogs.ts
import { Router } from 'express';
import { db } from '../config/database';
import { blogs } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();
const MAX_TITLE_LENGTH = 255;

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// All blog routes require authentication
router.use(authenticate);

// CREATE BLOG
router.post('/', async (req, res) => {
  try {
    const title = getString(req.body?.title);
    const description = getString(req.body?.description);
    const userId = req.user!.userId;
    
    if (!title) {
      return res.status(400).json({ error: 'Blog title is required' });
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        error: 'Blog title is too long',
        message: `Blog title must be ${MAX_TITLE_LENGTH} characters or less`
      });
    }
    
    // Generate slug from title
    const slug = createSlug(title);

    if (!slug) {
      return res.status(400).json({
        error: 'Invalid blog title',
        message: 'Blog title must contain at least one letter or number'
      });
    }
    
    // Check if user already has a blog with this slug
    const existingBlog = await db.query.blogs.findFirst({
      where: and(
        eq(blogs.userId, userId),
        eq(blogs.slug, slug)
      ),
    });
    
    if (existingBlog) {
      return res.status(409).json({
        error: 'Blog already exists',
        message: 'You already have a blog with this title'
      });
    }
    
    // Create blog
    const [blog] = await db.insert(blogs).values({
      userId,
      title,
      slug,
      description,
    }).returning();
    
    res.status(201).json({
      message: 'Blog created successfully',
      blog,
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ error: 'Failed to create blog' });
  }
});

// GET USER'S BLOGS (Multi-tenancy isolation)
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    // This query automatically filters by userId
    // The user can only see their own blogs
    const userBlogs = await db.query.blogs.findMany({
      where: and(
        eq(blogs.userId, userId),
        isNull(blogs.deletedAt) // Soft delete filter
      ),
      orderBy: (blogs, { desc }) => [desc(blogs.createdAt)],
    });
    
    res.json({
      blogs: userBlogs,
      total: userBlogs.length,
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

export default router;

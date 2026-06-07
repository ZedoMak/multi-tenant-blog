import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    pgEnum,
    uniqueIndex,
    index,
    integer,
    primaryKey
} from 'drizzle-orm/pg-core'

import {relations, sql} from 'drizzle-orm'


export const postStatusEnum = pgEnum('post_status', ['draft', 'published', 'archived'])

//users table
export const users = pgTable('users',{
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', {length: 255}).notNull().unique(),
    username: varchar('username', {length: 50}).notNull().unique(),
    passwordHash: varchar('password_hash', {length: 255}).notNull(),

    //profile fields

    displayName: varchar('display_name', {length: 100}),
    bio: text('bio'),
    avatarUrl: varchar('avatar_url', {length: 500}),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

    deletedAt:timestamp('deleted_at'),   
}, (table) => {
    return {
        // index : helps find data faster

        emailIdx: index('users_email_idx').on(table.email),
        usernameIdx: index('users_username_idx').on(table.username)
    }
})

// blogs table

export const blogs = pgTable('blogs', {
    
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(()=> users.id, {onDelete: 'cascade'}).notNull(),
    title: varchar('title', {length: 255}).notNull(),
    slug: varchar('slug', {length: 255}).notNull(),
    description: text('description'),

    // blog-level settings

    isPublic: boolean('is_public').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')

}, (table)=> {
    return{
        userSlugUnique: uniqueIndex('user_slug_unique').on(table.userId, table.slug),
        userIdIdx: index('blog_user_id_idx').on(table.userId)
    }
})


//posts table

export const posts = pgTable('posts', {
    id: uuid('id').defaultRandom().primaryKey(),
    blogId: uuid('blog_id').references(()=> blogs.id, {onDelete: 'cascade'}).notNull(),
    authorId: uuid('author_id').references(()=> users.id, {onDelete: 'cascade'}).notNull(),

    title: varchar('title', {length: 255}).notNull(),
    slug: varchar('slug', {length: 255}).notNull(),
    content: text('content'),
    excerpt: varchar('excerpt', {length: 500}),

    status: postStatusEnum('status').default('draft').notNull(),


    featuredImage: varchar('featured_image', {length: 500}),
    viewCount: integer('view_count').default(0).notNull(),
    readingTime: integer('reading_time'), 

    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
}, (table) =>{
    return{
        searchIdx: index('posts_search_idx').using('gin', 
            sql `to_tsvector('english', ${table.title} || ' ' || coalesce(${table.content}, ''))`
        ),
        blogSlugUnique: uniqueIndex('blog_slug_unique').on(table.blogId, table.slug),
        blogIdIdx: index('posts_blog_id_idx').on(table.blogId),
        authorIdIdx: index('posts_author_id_idx').on(table.authorId),
        statusIdx: index('posts_status_idx').on(table.status), 
    }
})

// tags table

export const tags = pgTable('tags', {

    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', {length: 50}).notNull().unique(),
    slug: varchar('slug', {length: 50}).notNull().unique(),
})

export const postTags = pgTable('post_tags', {
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => {
  return {
    // Composite primary key - ensures no duplicate post-tag combinations
    pk: primaryKey(table.postId, table.tagId),
    postIdIdx: index('post_tags_post_id_idx').on(table.postId),
    tagIdIdx: index('post_tags_tag_id_idx').on(table.tagId),
  };
});


// REFRESH TOKENS - For JWT authentication
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revoked: boolean('revoked').default(false).notNull(),
}, (table) => {
  return {
    userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    tokenIdx: index('refresh_tokens_token_idx').on(table.token),
  };
});

// Define -  relationships for Drizzle ORM
export const usersRelations = relations(users, ({ many }) => ({
  blogs: many(blogs),
  posts: many(posts),
  refreshTokens: many(refreshTokens),
}));

export const blogsRelations = relations(blogs, ({ one, many }) => ({
  user: one(users, {
    fields: [blogs.userId],
    references: [users.id],
  }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  blog: one(blogs, {
    fields: [posts.blogId],
    references: [blogs.id],
  }),
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  postTags: many(postTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
}));





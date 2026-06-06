import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../db/schema';
import process from 'node:process';

const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, {schema})

export async function testConnection() {
    try{
        const result = await sql `SELECT NOW()`
        console.log('Database connected succesfully at: ', result[0].now)
    }catch(error){
        console.error('Database connection failed', error)
        process.exit(1)
    }
}



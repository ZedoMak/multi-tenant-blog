import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import {verifyAccessToken} from '../utils/jwt'
import { db } from "../config/database";
import { posts } from "../db/schema";


//extend express request to include user info
declare global {
    namespace Express {
        interface Request{
            user?: {
                userId: string
                email: string
            }
        }
    }
}

// authentication middleware -> this runs before route handlers

export function authenticate(req: Request, res: Response, next: NextFunction){
    try{
        //get token from authorization header: "Bearer dhsbfbbgrebksb..."

        const authHeader = req.headers.authorization

        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({
                error: "Authentication required",
                message: 'Please provide a valid Bearer token'
            })
        }

        // extract the token
        const token = authHeader.split(' ')[1]

        //verify and then decode
        const decoded = verifyAccessToken(token)

        // passing user info to route handlers

        req.user = {
            userId: decoded.userId,
            email: decoded.email
        }

        // calling next will make proceed to the route handler

    
        next()

    }catch(error){
        return res.status(401).json({
            error: 'Invalid or expired token',
            message: 'Please login again'
        })
    }
}

// authorization middleware -> resource ownership
// enusures users can only modify their own resource

export async function authorizeOwner(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try{
        const resourceId = req.params.id
        const userId = req.user?.userId

        if(!userId){
            return res.status(401).json({error: 'Authentication required'})
        }

        if(typeof resourceId !== 'string'){
            return res.status(400).json({error: 'Resource id is required'})
        }

        //fetch the resource from database

        const resource = await db.query.posts.findFirst({
            where: eq(posts.id, resourceId)
        })

        if(!resource){
            return res.status(404).json({error: 'Resource not found'})
        }

        // CHECK OWNERSHIP

        if(resource.authorId !== userId){
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You can only modify your own resources'
            })
        }

        next()

    }catch(error){
        next(error)
    }
}



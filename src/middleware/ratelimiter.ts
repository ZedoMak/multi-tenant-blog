import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

type RequestWithUser = Request & {
    user?: {
        userId: string
    }
}

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limits each ip to 100 requests per window
    message: {
        error: 'Too many requests',
        message: 'Please try again later'
    },

    standardHeaders: true, // return rate limit info in headers
    legacyHeaders: false
})

export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // an hour,
    max: 20, // 20 posts per person,
    message:{
        error: 'Post limit reached',
        message: 'You can only create 20 posts per hour'
    },
    
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req)=>{
        const userId = (req as RequestWithUser).user?.userId
        const ip = req.ip || req.socket.remoteAddress

        return userId || (ip ? ipKeyGenerator(ip) : 'unknown-ip')
    },
})

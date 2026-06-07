import {Router} from 'express'
import {db} from '../config/database'
import {users, refreshTokens} from '../db/schema'
import { and, eq, isNull, or } from 'drizzle-orm'
import { comparePassword, hashPassword } from '../utils/password'
import {
    generateAccessToken,
    generateRefreshToken,
} from '../utils/jwt'

import { authLimiter } from '../middleware/ratelimiter'
import {authenticate} from '../middleware/auth'

const router = Router()
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60

function getString(value: unknown): string | undefined {
    return typeof value === 'string' ? value.trim() : undefined
}

function getPassword(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

function getEmail(value: unknown): string | undefined {
    return getString(value)?.toLowerCase()
}

// register

router.post('/register', authLimiter, async (req,res)=>{
    try{
        const email = getEmail(req.body?.email)
        const username = getString(req.body?.username)
        const password = getPassword(req.body?.password)
        const displayName = getString(req.body?.displayName)

        if(!email || !username || !password){
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, username, and password are required'
            })
        }

        if(password.length < 8){
            return res.status(400).json({
                error: 'weak password',
                message: 'Password must be at least 8 characters long'
            })
        }

        const existingUser = await db.query.users.findFirst({
            where: or(eq(users.email, email), eq(users.username, username))
        })

        if(existingUser){
            const field = existingUser.email === email ? 'email' : 'username'

            return res.status(409).json({
                error: 'User already exists',
                message: `An account with this ${field} already exists`
            })
        }

        const passwordHash = await hashPassword(password)

        const [newUser] = await db.insert(users).values({
            email,
            username,
            passwordHash,
            displayName: displayName || username
        }).returning({
            id: users.id,
            email: users.email,
            username: users.username
        })

        //generate token

        const accessToken = generateAccessToken({
            userId: newUser.id,
            email: newUser.email
        })

        const refreshToken = generateRefreshToken(newUser.id)

        // store the refresh token in db

        await db.insert(refreshTokens).values({
            userId: newUser.id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
        })

        res.status(201).json({
            message: 'User registered succesfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
            },
        })
    } catch (error){
        console.error('Registration error:', error)
        res.status(500).json({
            error: 'Registration failed',
            message: 'An unexpected error occured'
        })
    }
})


//login 

router.post('/login', authLimiter, async (req, res)=>{
    try{
        const email = getEmail(req.body?.email)
        const password = getPassword(req.body?.password)
        
        if (!email || !password){
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Email and password are required'
            })
        }

        // find user

        const user = await db.query.users.findFirst({
            where: and(eq(users.email, email), isNull(users.deletedAt)),
        })

        if(!user){
            return res.status(401).json({
                error: 'Invalid credential',
                message: 'Email or password is incorrect'
            })
        }

        const isValidPassword = await comparePassword(password, user.passwordHash)

        if(!isValidPassword){
            return res.status(401).json({
                error: 'Invalid credential',
                message: 'Email or password is incorrect'
            })
        }

        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email
        })

        const refreshToken = generateRefreshToken(user.id)

        await db.insert(refreshTokens).values({
            userId: user.id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
        })

        res.json({
            message: 'Login succesful',
            user:{
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
            },
            tokens:{
                accessToken,
                refreshToken,
                expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
            }
        })

    } catch(error){
        console.error('Login failed', error)
        res.status(500).json({
            error: 'Login failed',
            message: 'An unexpected error occured'
        })
    }
})

router.post('/refresh-token', authLimiter, async (req, res) => {
  try {
    const refreshToken = getString(req.body?.refreshToken);
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }
    
    // Find the refresh token in database
    const storedToken = await db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.token, refreshToken), eq(refreshTokens.revoked, false)),
    });
    
    if (!storedToken) {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }
    
    // Check if token is expired or revoked
    if (storedToken.revoked || new Date() > storedToken.expiresAt) {
      await db.update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.id, storedToken.id));

      return res.status(401).json({
        error: 'Refresh token expired or revoked'
      });
    }
    
    // Get user info
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, storedToken.userId), isNull(users.deletedAt)),
    });
    
    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }
    
    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    
    
    res.json({
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
});

// LOGOUT - Revoke refresh token
router.post('/logout', authenticate, async (req, res) => {
  try {
    const refreshToken = getString(req.body?.refreshToken);
    
    if (refreshToken) {
      // Revoke the specific refresh token
      await db.update(refreshTokens)
        .set({ revoked: true })
        .where(and(
          eq(refreshTokens.token, refreshToken),
          eq(refreshTokens.userId, req.user!.userId)
        ));
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

export default router;

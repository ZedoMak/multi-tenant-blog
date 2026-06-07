import jwt, {type SignOptions} from 'jsonwebtoken'
import {v4 as uuidv4} from 'uuid'

//header.payload.signature

interface TokenPayload{
    userId: string
    email: string
}

export function generateAccessToken(payload: TokenPayload): string {
    const expiresIn = (process.env.JWT_ACCESS_EXPIRY || '15m') as SignOptions['expiresIn']

    return jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET!,
        {expiresIn}
    )
}

export function generateRefreshToken(userId: string):string {
    return uuidv4() + '-' + uuidv4()
}

export function verifyAccessToken(token: string):TokenPayload {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as TokenPayload
}


//token type for response

export interface TokenResponse{
    accessToken: string
    refreshToken: string
    expiresIn: number
}

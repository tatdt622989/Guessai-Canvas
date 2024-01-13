export interface SimpleUser
{
    name: string;
    photo: string;
    score: number;
}

 export interface Message
 {
    _id: number;
    user: SimpleUser;
    message: string;
    isCorrect: boolean;
 }
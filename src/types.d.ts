export interface SimpleUser {
  name: string;
  photo: string;
  score: number;
}

export interface Message {
  _id: string;
  user: SimpleUser;
  message: string;
  isCorrect: boolean;
  status: string;
  createdAt: string;
}

export interface GuessAICanvas {
  _id: string;
  canvas: string;
  solved: boolean;
  answerEN: string;
  answerTW: string;
  answerJP: string;
  correctRespondent: SimpleUser;
}

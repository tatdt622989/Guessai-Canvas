const API_URL:string = process.env.NODE_ENV === 'production' ? 'https://app.6yuwei.com/guessai_canvas/api' : 'http://localhost:5173/api';

export default API_URL;

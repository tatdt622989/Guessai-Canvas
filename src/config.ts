const API_URL:string = process.env.NODE_ENV === 'production' ? 'https://app.6yuwei.com/guessai_canvas/api' : 'http://localhost:5173/api';
const ROOT_PATH:string = process.env.NODE_ENV === 'production' ? '/guessai_canvas/' : '/';

export { API_URL, ROOT_PATH };

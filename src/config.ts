const API_URL:string = process.env.NODE_ENV === 'production' ? 'https://api.6yuwei.com/' : 'http://localhost:5173/api';

export default API_URL;

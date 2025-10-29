export function getViteTdToken() {
    const VITE_TD_TOKEN = (
      import.meta as any
    ).env.VITE_TD_TOKEN;
    const tokens = VITE_TD_TOKEN.split(',');
    const randomIndex = Math.floor(Math.random() * tokens.length);
    return tokens[randomIndex];
  }
// Cole aqui as configurações do seu projeto Firebase.
// Firebase Console > Configurações do projeto > Seus apps > App Web > SDK setup and configuration.

export const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

// Deixe false para usar o Firebase normal.
// Só altere para true se você souber configurar os emuladores locais do Firebase.
export const USE_EMULATORS = false;

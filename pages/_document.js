import { Html, Head, Main, NextScript } from 'next/document';

// Applies the saved theme before first paint to avoid a flash of the default
// (dark) theme when the user's saved preference is "clean".
const themeInitScript = `(function(){try{var t=JSON.parse(localStorage.getItem('theme'));document.documentElement.setAttribute('data-theme',(t==='clean'||t==='dark')?t:'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function Document() {
  return (
    <Html>
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

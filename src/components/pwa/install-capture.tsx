import Script from "next/script";

/* ============================================================
 * Early capture of `beforeinstallprompt`.
 *
 * THE BUG THIS FIXES: Chrome fires beforeinstallprompt as soon as
 * it decides the app is installable — which is routinely BEFORE
 * React has hydrated. A listener registered inside useEffect
 * therefore misses it, and the install button never appears.
 *
 * So we stash the event on `window` from an inline script that
 * runs during the initial HTML parse, long before hydration. The
 * React component then reads whatever was captured, as well as
 * listening for a later firing.
 *
 * The script is tiny, has no dependencies and touches nothing
 * else on the page.
 * ============================================================ */

export function InstallCapture() {
  return (
    <Script id="rego-install-capture" strategy="beforeInteractive">
      {`(function(){
        try {
          window.__regoInstallEvent = null;
          window.addEventListener('beforeinstallprompt', function (e) {
            // Suppress Chrome's own mini-infobar so our card is the
            // only install UI the user sees.
            e.preventDefault();
            window.__regoInstallEvent = e;
            // Let React know, in case it hydrated after this fired.
            window.dispatchEvent(new Event('rego-installable'));
          });
          window.addEventListener('appinstalled', function () {
            window.__regoInstallEvent = null;
            try { localStorage.setItem('rego-install-dismissed','installed'); } catch (err) {}
          });
        } catch (err) { /* never break the page over an install prompt */ }
      })();`}
    </Script>
  );
}

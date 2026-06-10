/* App — composes the landing page with Tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroLayout": "A1",
  "accent": "#2c6fe6",
  "showTicker": true,
  "showVirt": true
}/*EDITMODE-END*/;

const ACCENT_PALETTES = {
  '#2c6fe6': '#5b9dff', // blue (default)
  '#7bd1ff': '#a8e2ff', // cyan
  '#a78bfa': '#c4b1ff', // violet
  '#f5d061': '#ffe4a0', // gold
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // scroll state for sticky nav
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive:true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // apply accent CSS variables based on tweak
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-glow', ACCENT_PALETTES[t.accent] || '#5b9dff');
  }, [t.accent]);

  return (
    <>
      <Nav scrolled={scrolled} />
      <HeroA1 />
      <Features />
      <DashboardPreview />
      {t.showVirt && <VirtMode />}
      {t.showTicker && <LiveTicker />}
      <Pricing />
      <CTA />
      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakColor
          label="강조 색"
          value={t.accent}
          options={Object.keys(ACCENT_PALETTES)}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakSection label="Sections" />
        <TweakToggle
          label="VIRT 모드 섹션"
          value={t.showVirt}
          onChange={(v) => setTweak('showVirt', v)}
        />
        <TweakToggle
          label="실시간 시세 위젯"
          value={t.showTicker}
          onChange={(v) => setTweak('showTicker', v)}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

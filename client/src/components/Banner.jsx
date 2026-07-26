import React from 'react';

const Banner = ({
  stats = null,
  title = 'Intelligent Solutions',
  highlight = 'Built for Every Team',
  subtitle = 'Explore and launch AI tools developed by the Centre of Excellence empowering every team across KPMG, powered by Azure OpenAI.',
  tag = 'KPMG AI CENTRE OF EXCELLENCE',
  centeredTitle = false,
}) => {
  const fallbackStats = [
    { val: '11', em: '+', lbl: 'Solutions' },
    { val: '5', em: '', lbl: 'Domains' },
    { val: '40', em: '%', lbl: 'Time Saved' },
  ];

  const data = stats && stats.length ? stats : fallbackStats;

  return (
    <section className={`banner ${centeredTitle ? 'banner--title-only' : ''}`}>
      <div className="banner-bg" />
      <div className="banner-orb" />
      <div className="banner-orb2" />

      <div className="banner-content">
        {centeredTitle ? (
          <h1 className="banner-title-only">
            {title}
          </h1>
        ) : (
          <>
            <div className="banner-copy">
              <div className="banner-tag">
                <span className="banner-tag-dot" />
                {tag}
              </div>

              <h1 className="banner-title">
                {title}
                <br />
                <span className="bac">{highlight}</span>
              </h1>

              <p className="banner-sub">
                {subtitle}
              </p>
            </div>

            <div className="banner-stats">
              {data.map((stat, idx) => (
                <div className="bstat" key={idx}>
                  <div className="bstat-val">
                    {stat.val}
                    {stat.em ? <em>{stat.em}</em> : null}
                  </div>
                  <div className="bstat-lbl">{stat.lbl}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default Banner;
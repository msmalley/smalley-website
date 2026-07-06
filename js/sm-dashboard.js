(function() {
  var snapshotUrl = SM.url('/dashboard/data/snapshot.json?v=' + SM.VERSION);

  fetch(snapshotUrl).then(function(r) { return r.json(); }).then(render).catch(function(e) {
    document.getElementById('dashboard-meta').textContent = 'Failed to load snapshot: ' + e.message;
  });

  function render(data) {
    renderMeta(data._meta);
    renderAlerts(data);
    renderIndicators(data.indicators);
    if (data.employment) renderEmployment(data.employment);
    if (data.social) renderSocial(data.social);
    if (data.analytics) renderAnalytics(data.analytics);
    if (data.agents) renderAgents(data.agents);
    if (data.github) renderGitHub(data.github);
    if (data.cloudflare) renderCloudflare(data.cloudflare, data.analytics);
    if (data.ecosystem) renderEcosystem(data.ecosystem);
    if (data.investment) renderInvestment(data.investment);
  }

  function renderAlerts(data) {
    var alerts = data.alerts || [];
    if (!alerts.length) return;

    var container = document.querySelector('.dashboard-hero');
    var alertsEl = SM.el('div', { class: 'dashboard-alerts' });

    for (var i = 0; i < alerts.length; i++) {
      var a = alerts[i];
      var icon = a.level === 'critical' ? '!!!' : a.level === 'warning' ? '!!' : 'i';

      var bannerChildren = [
        SM.el('div', { class: 'alert-icon' }, icon),
        SM.el('div', { class: 'alert-body' },
          SM.el('div', { class: 'alert-title' }, a.title),
          SM.el('div', { class: 'alert-detail' }, a.detail)
        )
      ];

      if (a.cta) {
        var ctaEl;
        if (a.cta.action === 'link') {
          ctaEl = SM.el('a', { class: 'alert-cta', href: a.cta.url, target: '_blank', rel: 'noopener' }, a.cta.label);
        } else if (a.cta.action === 'bash') {
          ctaEl = SM.el('div', { class: 'alert-cta alert-cta-code' },
            SM.el('span', { class: 'alert-cta-label' }, a.cta.label + ':'),
            SM.el('code', {}, a.cta.command)
          );
        } else {
          ctaEl = SM.el('div', { class: 'alert-cta alert-cta-prompt' }, a.cta.command);
        }
        bannerChildren.push(ctaEl);
      }

      alertsEl.appendChild(SM.el('div', { class: 'alert-banner', 'data-level': a.level, 'data-category': a.category },
        ...bannerChildren
      ));
    }
    container.parentNode.insertBefore(alertsEl, container.nextSibling);
  }

  function renderMeta(meta) {
    var age = Math.round((Date.now() - new Date(meta.generated_at).getTime()) / 60000);
    var label = age < 60 ? age + ' min ago' : Math.round(age / 60) + 'h ago';
    document.getElementById('dashboard-meta').textContent = 'Snapshot: ' + label + ' · Sources: ' + meta.sources_ok.length + '/' + (meta.sources_ok.length + meta.sources_failed.length);
  }

  function renderIndicators(indicators) {
    var strip = document.getElementById('indicator-strip');
    var keys = ['job_pipeline', 'social_engagement', 'application_response', 'agent_success', 'content_cadence'];
    for (var i = 0; i < keys.length; i++) {
      var ind = indicators[keys[i]];
      strip.appendChild(SM.el('div', { class: 'indicator-card' },
        SM.el('div', { class: 'indicator-header' },
          SM.el('span', { class: 'indicator-dot', 'data-status': ind.status }),
          SM.el('span', { class: 'indicator-label' }, ind.label)
        ),
        SM.el('div', { class: 'indicator-detail' }, ind.detail)
      ));
    }
    renderSubnav();
  }

  function renderSubnav() {
    var nav = SM.el('nav', { class: 'dashboard-subnav', id: 'dashboard-subnav' });
    var links = [
      { id: 'section-employment', label: 'Employment' },
      { id: 'section-social', label: 'Social' },
      { id: 'section-analytics', label: 'Analytics' },
      { id: 'section-agents', label: 'Agents' },
      { id: 'section-github', label: 'GitHub' },
      { id: 'section-cloudflare', label: 'Workers' },
      { id: 'section-ecosystem', label: 'Ecosystem' },
      { id: 'section-investment', label: 'Investment' }
    ];
    for (var i = 0; i < links.length; i++) {
      var a = SM.el('a', { class: 'subnav-link', href: '#' + links[i].id, 'data-target': links[i].id }, links[i].label);
      a.addEventListener('click', function(e) {
        e.preventDefault();
        var target = document.getElementById(this.getAttribute('data-target'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(a);
    }
    var indicatorSection = document.querySelector('.dashboard-indicators');
    indicatorSection.parentNode.insertBefore(nav, indicatorSection.nextSibling);

    var observer = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var id = entries[i].target.id;
          var allLinks = nav.querySelectorAll('.subnav-link');
          for (var j = 0; j < allLinks.length; j++) {
            allLinks[j].classList.toggle('active', allLinks[j].getAttribute('data-target') === id);
          }
        }
      }
    }, { rootMargin: '-80px 0px -60% 0px' });

    for (var i = 0; i < links.length; i++) {
      var section = document.getElementById(links[i].id);
      if (section) observer.observe(section);
    }
  }

  function barChart(items, maxVal) {
    var chart = SM.el('div', { class: 'bar-chart' });
    for (var i = 0; i < items.length; i++) {
      var pct = maxVal > 0 ? Math.max(2, (items[i].value / maxVal) * 100) : 2;
      chart.appendChild(SM.el('div', { class: 'bar-row' },
        SM.el('span', { class: 'bar-label' }, items[i].label),
        SM.el('div', { class: 'bar-track' },
          SM.el('div', { class: 'bar-fill', 'data-accent': items[i].accent || 'teal', style: { width: pct + '%' } })
        ),
        SM.el('span', { class: 'bar-value' }, String(items[i].value))
      ));
    }
    return chart;
  }

  function statPanel(title, rows) {
    var panel = SM.el('div', { class: 'dashboard-panel' },
      SM.el('div', { class: 'dashboard-panel-title' }, title)
    );
    for (var i = 0; i < rows.length; i++) {
      panel.appendChild(SM.el('div', { class: 'stat-row' },
        SM.el('span', { class: 'stat-label' }, rows[i].label),
        SM.el('span', { class: 'stat-value' }, rows[i].value)
      ));
    }
    return panel;
  }

  function isLightColor(hex) {
    if (!hex || hex.startsWith('var')) return false;
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    var r = parseInt(c.substr(0,2), 16);
    var g = parseInt(c.substr(2,2), 16);
    var b = parseInt(c.substr(4,2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  function deltaStr(val) {
    if (val == null || val === 0) return { text: '—', cls: 'delta-flat' };
    if (val > 0) return { text: '+' + val, cls: 'delta-up' };
    return { text: String(val), cls: 'delta-down' };
  }

  function pctStr(val) {
    if (val == null) return '—';
    var sign = val >= 0 ? '+' : '';
    return sign + Math.round(val * 100) + '%';
  }

  function renderEmployment(emp) {
    var el = document.getElementById('employment-content');
    var grid = SM.el('div', { class: 'dashboard-grid-2' });

    var funnelMax = Math.max(emp.funnel.discovered, emp.funnel.scored, emp.funnel.new, emp.funnel.applied);
    var funnelItems = [
      { label: 'Discovered', value: emp.funnel.discovered, accent: 'muted' },
      { label: 'Scored', value: emp.funnel.scored, accent: 'gold' },
      { label: 'New', value: emp.funnel.new, accent: 'teal' },
      { label: 'Applied', value: emp.funnel.applied, accent: 'violet' },
      { label: 'Rejected', value: emp.funnel.rejected, accent: 'red' }
    ];
    var funnelPanel = SM.el('div', { class: 'dashboard-panel' },
      SM.el('div', { class: 'dashboard-panel-title' }, 'Pipeline Funnel'),
      barChart(funnelItems, funnelMax)
    );
    grid.appendChild(funnelPanel);

    var scoreMax = Math.max.apply(null, emp.score_distribution.map(function(s) { return s.count; }));
    var scoreItems = emp.score_distribution.map(function(s) {
      return { label: s.range, value: s.count, accent: s.range === '80+' ? 'teal' : s.range === '70-79' ? 'teal' : 'gold' };
    });
    var scorePanel = SM.el('div', { class: 'dashboard-panel' },
      SM.el('div', { class: 'dashboard-panel-title' }, 'Score Distribution'),
      barChart(scoreItems, scoreMax)
    );
    grid.appendChild(scorePanel);
    el.appendChild(grid);

    if (emp.top_leads && emp.top_leads.length) {
      var leadsPanel = SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } });
      var leadsHeader = SM.el('div', { style: { marginBottom: '14px' } });

      // Title row: title + count on left, search on right
      var leadsTitleRow = SM.el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } });
      var leadsTitleLeft = SM.el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } });
      var leadsTitle = SM.el('div', { class: 'dashboard-panel-title', style: { marginBottom: '0' } }, 'Actionable Leads');
      var leadsCount = SM.el('span', { style: { fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--sm-muted)' } }, String(emp.top_leads.length) + ' total');
      leadsTitleLeft.appendChild(leadsTitle);
      leadsTitleLeft.appendChild(leadsCount);
      leadsTitleRow.appendChild(leadsTitleLeft);

      // Two-column filter grid to use full width
      var controlsGrid = SM.el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', padding: '10px 14px', background: 'var(--sm-surface)', borderRadius: '8px', border: '1px solid var(--sm-border)' } });

      function makeFilterRow(label, bar) {
        var row = SM.el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
        row.appendChild(SM.el('span', { style: { fontFamily: 'var(--f-mono)', fontSize: '9px', fontWeight: '700', color: 'var(--sm-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '52px' } }, label));
        row.appendChild(bar);
        return row;
      }
      function makeButtonGroup() {
        return SM.el('div', { style: { display: 'flex', gap: '3px', flexWrap: 'wrap', alignItems: 'center' } });
      }

      var filterBar = makeButtonGroup();
      var filters = [
        { key: 'all', label: 'All', color: 'var(--sm-text)' },
        { key: 'cto', label: 'CTO', color: 'var(--sm-teal-glow)' },
        { key: 'regtech', label: 'REG', color: 'var(--sm-gold-glow)' },
        { key: 'devrel', label: 'DEV', color: 'var(--sm-violet-glow)' }
      ];
      var locationBar = makeButtonGroup();
      var locationFilters = [
        { key: 'any', label: 'Any' },
        { key: 'remote', label: 'Remote' },
        { key: 'uk', label: 'UK' },
        { key: 'other', label: 'Other' }
      ];
      var confidenceBar = makeButtonGroup();
      var confidenceFilters = [
        { key: 'any', label: 'Any' },
        { key: 'high', label: 'High' },
        { key: 'medium', label: 'Med' },
        { key: 'low', label: 'Low' }
      ];
      var freshnessBar = makeButtonGroup();
      var freshnessFilters = [
        { key: 'any', label: 'Any' },
        { key: 'fresh', label: '< 7d' },
        { key: 'aging', label: '7-14d' },
        { key: 'stale', label: '> 14d' },
        { key: 'unknown', label: 'No date' }
      ];
      var channelBar = makeButtonGroup();
      var channelFilters = [
        { key: 'any', label: 'Any' },
        { key: 'linkedin_apply', label: 'LI Apply' },
        { key: 'direct_url', label: 'Direct' },
        { key: 'unknown', label: 'Unknown' }
      ];
      var sortBar = makeButtonGroup();
      var sortOptions = [
        { key: 'best', label: 'Best Score' },
        { key: 'avg', label: 'Avg Score' },
        { key: 'spread', label: 'Spread' },
        { key: 'age', label: 'Age' }
      ];
      var orderBar = makeButtonGroup();
      var orderOptions = [
        { key: 'desc', label: '↓ Desc' },
        { key: 'asc', label: '↑ Asc' }
      ];
      var searchInput = SM.el('input', { type: 'text', placeholder: 'Search role or company...', style: {
        fontFamily: 'var(--f-body)', fontSize: '12px', padding: '6px 12px',
        borderRadius: '6px', border: '1px solid var(--sm-border)',
        background: 'var(--sm-surface)', color: 'var(--sm-text)',
        width: '200px', outline: 'none'
      } });
      function classifyLocation(loc) {
        if (!loc) return 'other';
        var l = loc.toLowerCase();
        if (l.includes('remote') || l.includes('global') || l.includes('distributed')) return 'remote';
        if (l.includes('uk') || l.includes('united kingdom') || l.includes('london') || l.includes('manchester') || l.includes('england') || l.includes('yorkshire') || l.includes('scotland') || l.includes('wales') || l.includes('emea')) return 'uk';
        return 'other';
      }
      function classifyFreshness(daysOld) {
        if (daysOld == null) return 'unknown';
        if (daysOld <= 7) return 'fresh';
        if (daysOld <= 14) return 'aging';
        return 'stale';
      }
      var leadsContainer = SM.el('div');
      var activeFilter = 'all';
      var activeConfidence = 'any';
      var activeLocation = 'any';
      var activeFreshness = 'any';
      var activeChannel = 'any';
      var activeSort = 'best';
      var activeOrder = 'desc';
      var searchQuery = '';
      var DEFAULT_SHOW = 10;

      function getSpread(l) {
        if (!l.scores) return 0;
        return Math.max(l.scores.cto, l.scores.regtech, l.scores.devrel) - Math.min(l.scores.cto, l.scores.regtech, l.scores.devrel);
      }

      function renderFilterButtons() {
        controlsGrid.querySelectorAll('button[data-group]').forEach(function(btn) {
          var group = btn.dataset.group;
          var val = btn.dataset.val;
          var active = false;
          if (group === 'variant') active = val === activeFilter;
          else if (group === 'confidence') active = val === activeConfidence;
          else if (group === 'location') active = val === activeLocation;
          else if (group === 'freshness') active = val === activeFreshness;
          else if (group === 'channel') active = val === activeChannel;
          else if (group === 'sort') active = val === activeSort;
          else if (group === 'order') active = val === activeOrder;
          if (active) {
            btn.style.background = 'var(--sm-surface-alt)';
            btn.style.borderColor = btn.style.color;
            btn.style.fontWeight = '700';
          } else {
            btn.style.background = 'transparent';
            btn.style.borderColor = 'var(--sm-border)';
            btn.style.color = 'var(--sm-muted)';
            btn.style.fontWeight = '500';
          }
        });
        // Re-apply variant colours for CV row
        filterBar.querySelectorAll('button').forEach(function(btn) {
          var val = btn.dataset.val;
          var colors = { all: 'var(--sm-text)', cto: 'var(--sm-teal-glow)', regtech: 'var(--sm-gold-glow)', devrel: 'var(--sm-violet-glow)' };
          if (val === activeFilter) {
            btn.style.color = colors[val] || 'var(--sm-text)';
            btn.style.borderColor = colors[val] || 'var(--sm-text)';
          }
        });
        // Re-apply sort colour
        sortBar.querySelectorAll('button').forEach(function(btn) {
          if (btn.dataset.val === activeSort) {
            btn.style.color = 'var(--sm-teal)';
            btn.style.borderColor = 'var(--sm-teal)';
          }
        });
      }

      function renderLeadCards() {
        leadsContainer.innerHTML = '';
        var leads = emp.top_leads.slice();
        if (activeConfidence !== 'any') {
          leads = leads.filter(function(l) { return l.confidence === activeConfidence; });
        }
        if (activeLocation !== 'any') {
          leads = leads.filter(function(l) { return classifyLocation(l.location) === activeLocation; });
        }
        if (activeFreshness !== 'any') {
          leads = leads.filter(function(l) { return classifyFreshness(l.days_old) === activeFreshness; });
        }
        if (activeChannel !== 'any') {
          leads = leads.filter(function(l) { return (l.channel_method || 'unknown') === activeChannel; });
        }
        if (activeFilter !== 'all') {
          leads = leads.filter(function(l) { return l.scores; });
        }
        leads.sort(function(a, b) {
          var dir = activeOrder === 'asc' ? -1 : 1;
          var diff = 0;
          if (activeSort === 'age') {
            diff = (b.days_old || 0) - (a.days_old || 0);
          } else if (activeSort === 'spread') {
            diff = getSpread(b) - getSpread(a);
          } else if (activeSort === 'avg') {
            var avgA = a.scores ? Math.round((a.scores.cto + a.scores.regtech + a.scores.devrel) / 3) : (a.score || 0);
            var avgB = b.scores ? Math.round((b.scores.cto + b.scores.regtech + b.scores.devrel) / 3) : (b.score || 0);
            diff = avgB - avgA;
          } else if (activeFilter !== 'all') {
            diff = (b.scores[activeFilter] || 0) - (a.scores[activeFilter] || 0);
          } else {
            var bestA = a.score || (a.scores ? Math.max(a.scores.cto, a.scores.regtech, a.scores.devrel) : 0);
            var bestB = b.score || (b.scores ? Math.max(b.scores.cto, b.scores.regtech, b.scores.devrel) : 0);
            diff = bestB - bestA;
          }
          return diff * dir;
        });
        if (searchQuery) {
          var q = searchQuery.toLowerCase();
          leads = leads.filter(function(l) {
            return (l.role || '').toLowerCase().includes(q) || (l.company || '').toLowerCase().includes(q) || (l.title || '').toLowerCase().includes(q);
          });
        }
        updateLeadsCount(leads.length);

        var showCount = (searchQuery || activeFilter !== 'all' || activeConfidence !== 'any' || activeLocation !== 'any') ? leads.length : Math.min(leads.length, DEFAULT_SHOW);
        for (var li = 0; li < showCount; li++) {
          var lead = leads[li];

          var cardWrapper = SM.el('div', { style: { marginBottom: '4px' } });
          var cardAttrs = { class: 'lead-card' };

          var scoreEls = SM.el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } });
          if (lead.scores) {
            var cvs = [
              { key: 'cto', label: 'CTO', color: 'var(--sm-teal-glow)' },
              { key: 'regtech', label: 'REG', color: 'var(--sm-gold-glow)' },
              { key: 'devrel', label: 'DEV', color: 'var(--sm-violet-glow)' }
            ];
            var displayScore;
            var avgScore = Math.round((lead.scores.cto + lead.scores.regtech + lead.scores.devrel) / 3);
            if (activeFilter !== 'all') {
              displayScore = lead.scores[activeFilter] || 0;
            } else {
              displayScore = lead.score || Math.max(lead.scores.cto, lead.scores.regtech, lead.scores.devrel);
            }
            var spread = getSpread(lead);
            scoreEls.appendChild(SM.el('span', { style: { fontFamily: 'var(--f-mono)', fontSize: '14px', fontWeight: '700', color: 'var(--sm-text)', marginRight: '2px' } }, String(displayScore)));
            scoreEls.appendChild(SM.el('span', { title: 'Average across all 3 CVs', style: { fontFamily: 'var(--f-mono)', fontSize: '10px', color: 'var(--sm-muted)', marginRight: '4px' } }, 'avg ' + avgScore));
            scoreEls.appendChild(SM.el('span', { title: 'Spread (max - min variant)', style: { fontFamily: 'var(--f-mono)', fontSize: '10px', color: spread >= 30 ? 'var(--sm-teal-glow)' : spread >= 15 ? 'var(--sm-gold-glow)' : 'var(--sm-muted)', marginRight: '6px' } }, 'Δ' + spread));
            for (var ci = 0; ci < cvs.length; ci++) {
              var cv = cvs[ci];
              var s = lead.scores[cv.key] || 0;
              var isHighlighted = activeFilter !== 'all' ? cv.key === activeFilter : cv.key === lead.variant;
              scoreEls.appendChild(SM.el('span', { title: cv.label + ': ' + s, style: {
                fontFamily: 'var(--f-mono)', fontSize: '10px', fontWeight: '600',
                padding: '2px 6px', borderRadius: '4px', lineHeight: '1',
                background: isHighlighted ? cv.color : 'transparent',
                color: isHighlighted ? 'var(--sm-deep)' : cv.color,
                border: isHighlighted ? 'none' : '1px solid ' + cv.color,
                opacity: s >= 60 ? '1' : '0.4'
              } }, cv.label + ' ' + s));
            }
          } else {
            scoreEls.appendChild(SM.el('div', { class: 'lead-score' }, String(lead.score)));
          }

          // Freshness colour: green < 7d, yellow 7-14d, red > 14d
          var freshColor = 'var(--sm-teal-glow)';
          if (lead.days_old > 14) freshColor = 'var(--sm-gold-glow)';
          if (lead.days_old > 21) freshColor = '#ef4444';
          var daysLabel = lead.days_old != null ? lead.days_old + 'd' : '';

          // Channel badge
          var channelLabel = '';
          var channelColor = 'var(--sm-muted)';
          if (lead.channel_method === 'linkedin_apply') { channelLabel = 'LI Apply'; channelColor = '#0a66c2'; }
          else if (lead.channel_method === 'direct_url') { channelLabel = 'Direct'; channelColor = 'var(--sm-teal-glow)'; }
          else if (lead.channel_method === 'email') { channelLabel = 'Email'; channelColor = 'var(--sm-violet-glow)'; }
          else { channelLabel = 'Unknown'; }

          var locStr = lead.location ? lead.location : '';
          var metaParts = [lead.company];
          if (locStr) metaParts.push(locStr);

          var infoEl = SM.el('div', { class: 'lead-info' },
            SM.el('div', { class: 'lead-role' }, lead.role),
            SM.el('div', { class: 'lead-company' }, metaParts.join(' · '))
          );

          // Badges row: freshness, channel, confidence
          var badges = SM.el('div', { style: { display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' } });
          if (daysLabel) {
            badges.appendChild(SM.el('span', { style: { fontFamily: 'var(--f-mono)', fontSize: '9px', fontWeight: '600', color: freshColor, background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px' } }, daysLabel));
          }
          badges.appendChild(SM.el('span', { style: { fontFamily: 'var(--f-mono)', fontSize: '9px', fontWeight: '600', color: channelColor, background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px' } }, channelLabel));
          if (lead.confidence && lead.confidence !== 'high') {
            var confColor = lead.confidence === 'low' ? 'var(--sm-gold-glow)' : 'var(--sm-muted)';
            badges.appendChild(SM.el('span', { style: { fontFamily: 'var(--f-mono)', fontSize: '9px', fontWeight: '600', color: confColor, background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px' } }, lead.confidence.toUpperCase()));
          }
          infoEl.appendChild(badges);

          var cardEl = SM.el('div', cardAttrs, infoEl, scoreEls);

          var detailEl = SM.el('div', { style: { display: 'none', padding: '10px 14px', background: 'var(--sm-surface)', borderRadius: '0 0 6px 6px', border: '1px solid var(--sm-border)', borderTop: 'none' } });
          if (lead.proof_points && lead.proof_points.length) {
            detailEl.appendChild(SM.el('div', { style: { fontFamily: 'var(--f-mono)', fontSize: '10px', fontWeight: '700', color: 'var(--sm-teal-glow)', marginBottom: '4px' } }, 'WHY THIS SCORE'));
            for (var pi = 0; pi < lead.proof_points.length; pi++) {
              var pp = lead.proof_points[pi];
              var ppEl = SM.el('div', { style: { marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--sm-teal)', fontSize: '11px', fontFamily: 'var(--f-body)' } });
              ppEl.appendChild(SM.el('div', { style: { color: 'var(--sm-text)', fontWeight: '500' } }, pp.requirement ? pp.requirement.slice(0, 80) : ''));
              ppEl.appendChild(SM.el('div', { style: { color: 'var(--sm-muted)', fontSize: '10px', marginTop: '2px' } }, pp.evidence ? pp.evidence.slice(0, 120) + '...' : ''));
              detailEl.appendChild(ppEl);
            }
          }
          if (lead.gaps && lead.gaps.length) {
            detailEl.appendChild(SM.el('div', { style: { fontFamily: 'var(--f-mono)', fontSize: '10px', fontWeight: '700', color: 'var(--sm-gold-glow)', marginTop: '8px', marginBottom: '4px' } }, 'GAPS'));
            for (var gi = 0; gi < lead.gaps.length; gi++) {
              detailEl.appendChild(SM.el('div', { style: { fontSize: '11px', fontFamily: 'var(--f-body)', color: 'var(--sm-muted)', paddingLeft: '8px', borderLeft: '2px solid var(--sm-gold)', marginBottom: '3px' } }, lead.gaps[gi].slice(0, 100)));
            }
          }
          if (lead.url) {
            detailEl.appendChild(SM.el('a', { href: lead.url, target: '_blank', rel: 'noopener', style: { fontFamily: 'var(--f-mono)', fontSize: '10px', color: 'var(--sm-teal-glow)', display: 'inline-block', marginTop: '6px' } }, 'Open listing →'));
          }

          // Toggle detail on click
          (function(card, detail) {
            card.addEventListener('click', function(e) {
              if (e.target.tagName === 'A') return;
              detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            });
          })(cardEl, detailEl);

          cardWrapper.appendChild(cardEl);
          cardWrapper.appendChild(detailEl);
          leadsContainer.appendChild(cardWrapper);
        }
        if (showCount < leads.length) {
          var showMore = SM.el('button', { style: {
            fontFamily: 'var(--f-body)', fontSize: '12px', color: 'var(--sm-teal-glow)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0',
            width: '100%', textAlign: 'center'
          } }, 'Show all ' + leads.length + ' leads');
          showMore.addEventListener('click', function() {
            DEFAULT_SHOW = 999;
            renderLeadCards();
          });
          leadsContainer.appendChild(showMore);
        }
        if (!leads.length) {
          leadsContainer.appendChild(SM.el('div', { style: { fontFamily: 'var(--f-body)', fontSize: '13px', color: 'var(--sm-muted)', padding: '16px 0' } }, 'No matching leads'));
        }
      }

      // Build all button groups with unified approach
      function addButtons(bar, items, group, defaultKey, color) {
        for (var i = 0; i < items.length; i++) {
          (function(item) {
            var btnColor = item.color || color || 'var(--sm-muted)';
            var isDefault = item.key === defaultKey;
            var btn = SM.el('button', { 'data-group': group, 'data-val': item.key, style: {
              fontFamily: 'var(--f-mono)', fontSize: '10px', fontWeight: '500',
              padding: '2px 7px', borderRadius: '3px', cursor: 'pointer',
              border: '1px solid ' + (isDefault ? btnColor : 'var(--sm-border)'),
              background: isDefault ? 'var(--sm-surface-alt)' : 'transparent',
              color: isDefault ? btnColor : 'var(--sm-muted)',
              transition: 'all 0.15s', lineHeight: '1.4'
            } }, item.label);
            btn.addEventListener('click', function() {
              if (group === 'variant') activeFilter = item.key;
              else if (group === 'confidence') activeConfidence = item.key;
              else if (group === 'location') activeLocation = item.key;
              else if (group === 'freshness') activeFreshness = item.key;
              else if (group === 'channel') activeChannel = item.key;
              else if (group === 'sort') activeSort = item.key;
              else if (group === 'order') activeOrder = item.key;
              renderFilterButtons();
              renderLeadCards();
            });
            bar.appendChild(btn);
          })(items[i]);
        }
      }

      addButtons(filterBar, filters, 'variant', 'all');
      addButtons(confidenceBar, confidenceFilters, 'confidence', 'any');
      addButtons(locationBar, locationFilters, 'location', 'any');
      addButtons(freshnessBar, freshnessFilters, 'freshness', 'any');
      addButtons(channelBar, channelFilters, 'channel', 'any');
      addButtons(sortBar, sortOptions, 'sort', 'best', 'var(--sm-teal)');
      addButtons(orderBar, orderOptions, 'order', 'desc', 'var(--sm-teal)');

      searchInput.addEventListener('input', function() {
        searchQuery = this.value;
        renderLeadCards();
      });

      // Search goes in title row (right side)
      leadsTitleRow.appendChild(searchInput);
      leadsHeader.appendChild(leadsTitleRow);

      // Assemble 2-column filter grid
      // Column 1: CV, Location, Channel
      // Column 2: Freshness, Data, Sort
      controlsGrid.appendChild(makeFilterRow('CV', filterBar));
      controlsGrid.appendChild(makeFilterRow('Fresh', freshnessBar));
      controlsGrid.appendChild(makeFilterRow('Location', locationBar));
      controlsGrid.appendChild(makeFilterRow('Data', confidenceBar));
      controlsGrid.appendChild(makeFilterRow('Channel', channelBar));
      // Sort row combines metric + direction
      var sortCombined = makeButtonGroup();
      sortBar.querySelectorAll('button').forEach(function(b) { sortCombined.appendChild(b); });
      sortCombined.appendChild(SM.el('span', { style: { width: '1px', height: '14px', background: 'var(--sm-border)', margin: '0 4px' } }));
      orderBar.querySelectorAll('button').forEach(function(b) { sortCombined.appendChild(b); });
      controlsGrid.appendChild(makeFilterRow('Sort', sortCombined));

      leadsHeader.appendChild(controlsGrid);

      function updateLeadsCount(showing) {
        leadsCount.textContent = showing !== emp.top_leads.length ? showing + ' / ' + emp.top_leads.length : emp.top_leads.length + ' total';
      }
      leadsPanel.appendChild(leadsHeader);
      leadsPanel.appendChild(leadsContainer);
      renderLeadCards();
      el.appendChild(leadsPanel);
    }
  }

  function renderSocial(social) {
    var el = document.getElementById('social-content');
    var grid = SM.el('div', { class: 'dashboard-grid-2' });

    grid.appendChild(statPanel('Aggregate', [
      { label: 'Total impressions', value: social.aggregate.total_impressions.toLocaleString() },
      { label: 'Total likes', value: String(social.aggregate.total_likes) },
      { label: 'Total comments', value: String(social.aggregate.total_comments) },
      { label: 'Engagement rate', value: (social.aggregate.engagement_rate * 100).toFixed(1) + '%' }
    ]));

    grid.appendChild(statPanel('Cadence', [
      { label: 'Total posts', value: String(social.cadence.total_posts) },
      { label: 'This week', value: String(social.cadence.posts_this_week) },
      { label: 'Days since last', value: String(social.cadence.days_since_last_post) }
    ]));

    el.appendChild(grid);

    if (social.posts.length) {
      var table = SM.el('table', { class: 'metrics-table' });
      table.appendChild(SM.el('thead', {},
        SM.el('tr', {},
          SM.el('th', {}, 'Post'), SM.el('th', {}, 'Platform'),
          SM.el('th', {}, 'Impressions'), SM.el('th', {}, 'Likes'), SM.el('th', {}, 'Comments')
        )
      ));
      var tbody = SM.el('tbody');
      for (var i = 0; i < social.posts.length; i++) {
        var p = social.posts[i];
        var contentCell = p.url
          ? SM.el('td', {}, SM.el('a', { href: p.url, target: '_blank', rel: 'noopener', style: { color: 'var(--sm-teal-glow)', textDecoration: 'none' } }, p.content_preview.slice(0, 40) + '...'))
          : SM.el('td', {}, p.content_preview.slice(0, 40) + '...');
        tbody.appendChild(SM.el('tr', {},
          contentCell,
          SM.el('td', {}, p.platform),
          SM.el('td', {}, String(p.metrics.impressions)),
          SM.el('td', {}, String(p.metrics.likes)),
          SM.el('td', {}, String(p.metrics.comments))
        ));
      }
      table.appendChild(tbody);
      var tablePanel = SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Post Performance'),
        table
      );
      el.appendChild(tablePanel);
    }

    var allComments = [];
    for (var i = 0; i < social.posts.length; i++) {
      var post = social.posts[i];
      if (post.recent_comments) {
        for (var j = 0; j < post.recent_comments.length; j++) {
          allComments.push({ author: post.recent_comments[j].author, text: post.recent_comments[j].text, platform: post.platform });
        }
      }
    }
    if (allComments.length) {
      var commentsPanel = SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Recent Comments')
      );
      for (var i = 0; i < allComments.length; i++) {
        var c = allComments[i];
        var platformTag = c.platform === 'linkedin' ? 'LI' : 'X';
        var platformColor = c.platform === 'linkedin' ? 'var(--sm-teal-glow)' : 'var(--sm-violet-glow)';
        commentsPanel.appendChild(SM.el('div', { class: 'comment-item' },
          SM.el('div', { class: 'comment-meta' },
            SM.el('span', { class: 'comment-platform', style: { color: platformColor } }, platformTag),
            SM.el('span', { class: 'comment-author' }, c.author)
          ),
          SM.el('span', { class: 'comment-text' }, c.text)
        ));
      }
      el.appendChild(commentsPanel);
    }
  }

  function renderAnalytics(analytics) {
    var el = document.getElementById('analytics-content');
    var grid = SM.el('div', { class: 'dashboard-grid-2' });
    var sites = [['smalley_my', 'smalley.my'], ['moddable_games', 'moddable.games']];

    for (var s = 0; s < sites.length; s++) {
      var key = sites[s][0], label = sites[s][1];
      var site = analytics[key];
      if (!site || site.error) {
        grid.appendChild(statPanel(label + ' (7d)', [{ label: 'Status', value: site?.error || 'No data' }]));
        continue;
      }
      var rows = [
        { label: 'Page views', value: site.period_7d.page_views + ' (' + pctStr(site.change_pct?.page_views) + ')' },
        { label: 'Sessions', value: site.period_7d.sessions + ' (' + pctStr(site.change_pct?.sessions) + ')' },
        { label: 'Users', value: site.period_7d.users + ' (' + pctStr(site.change_pct?.users) + ')' }
      ];
      grid.appendChild(statPanel(label + ' — Last 7 Days', rows));
    }
    el.appendChild(grid);

    var detailGrid = SM.el('div', { class: 'dashboard-grid-2', style: { marginTop: '24px' } });

    for (var s = 0; s < sites.length; s++) {
      var key = sites[s][0], label = sites[s][1];
      var site = analytics[key];
      if (!site || site.error) continue;

      if (site.referrers_30d && site.referrers_30d.length) {
        var refMax = site.referrers_30d[0].sessions;
        var refItems = site.referrers_30d.map(function(r) {
          return { label: r.source, value: r.sessions, accent: r.source.includes('linkedin') ? 'teal' : r.source.includes('t.co') ? 'violet' : 'gold' };
        });
        detailGrid.appendChild(SM.el('div', { class: 'dashboard-panel' },
          SM.el('div', { class: 'dashboard-panel-title' }, label + ' — Referrers (30d)'),
          barChart(refItems, refMax)
        ));
      }
    }
    el.appendChild(detailGrid);

    for (var s = 0; s < sites.length; s++) {
      var key = sites[s][0], label = sites[s][1];
      var site = analytics[key];
      if (!site || !site.top_pages_30d || !site.top_pages_30d.length) continue;

      var table = SM.el('table', { class: 'metrics-table' });
      table.appendChild(SM.el('thead', {},
        SM.el('tr', {},
          SM.el('th', {}, 'Page'), SM.el('th', {}, 'Views'),
          SM.el('th', {}, 'Avg Duration'), SM.el('th', {}, 'Engaged')
        )
      ));
      var tbody = SM.el('tbody');
      for (var i = 0; i < site.top_pages_30d.length; i++) {
        var p = site.top_pages_30d[i];
        var dur = p.avg_duration_s >= 60 ? Math.floor(p.avg_duration_s / 60) + 'm ' + (p.avg_duration_s % 60) + 's' : p.avg_duration_s + 's';
        var domain = key === 'smalley_my' ? 'https://smalley.my' : 'https://moddable.games';
        var pageLink = SM.el('a', { href: domain + p.path, target: '_blank', rel: 'noopener', style: { color: 'var(--sm-teal-glow)', textDecoration: 'none', fontFamily: 'var(--f-mono)', fontSize: '12px' } }, p.path);
        tbody.appendChild(SM.el('tr', {},
          SM.el('td', {}, pageLink),
          SM.el('td', {}, String(p.views)),
          SM.el('td', {}, dur),
          SM.el('td', {}, String(p.engaged))
        ));
      }
      table.appendChild(tbody);
      el.appendChild(SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, label + ' — Page Engagement (30d)'),
        table
      ));
    }

    // Events breakdown (custom interactions)
    var eventsGrid = SM.el('div', { class: 'dashboard-grid-2', style: { marginTop: '24px' } });
    for (var s = 0; s < sites.length; s++) {
      var key = sites[s][0], label = sites[s][1];
      var site = analytics[key];
      if (!site || !site.events_30d || !site.events_30d.length) continue;
      var evMax = site.events_30d[0].count;
      var evItems = site.events_30d.slice(0, 10).map(function(e) {
        var accent = e.event.includes('game') ? 'violet' : e.event.includes('tool') || e.event.includes('dice') || e.event.includes('hex') ? 'teal' : 'gold';
        return { label: e.event, value: e.count, accent: accent };
      });
      eventsGrid.appendChild(SM.el('div', { class: 'dashboard-panel' },
        SM.el('div', { class: 'dashboard-panel-title' }, label + ' — Interactions (30d)'),
        barChart(evItems, evMax)
      ));
    }
    el.appendChild(eventsGrid);
  }

  function renderAgents(agents) {
    var el = document.getElementById('agents-content');
    var grid = SM.el('div', { class: 'dashboard-grid-2' });

    var commitRows = [
      { label: 'This week', value: String(agents.commits_this_week?.total || 0) },
      { label: 'This month', value: String(agents.commits_this_month?.total || 0) }
    ];
    if (agents.commits_this_week?.by_repo) {
      for (var i = 0; i < agents.commits_this_week.by_repo.length; i++) {
        var r = agents.commits_this_week.by_repo[i];
        commitRows.push({ label: r.repo, value: String(r.commits) });
      }
    }
    grid.appendChild(statPanel('Commits', commitRows));

    var runs = agents.routine_runs || {};
    grid.appendChild(statPanel('Routine Results', [
      { label: 'Total runs', value: String(runs.total) },
      { label: 'Pass', value: String(runs.pass) },
      { label: 'Partial', value: String(runs.partial) },
      { label: 'Fail', value: String(runs.fail) },
      { label: 'Success rate', value: runs.total ? Math.round(runs.pass / runs.total * 100) + '%' : '—' }
    ]));

    el.appendChild(grid);

    if (agents.routines && agents.routines.length) {
      var routinePanel = SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Active Routines')
      );
      for (var i = 0; i < agents.routines.length; i++) {
        var rt = agents.routines[i];
        routinePanel.appendChild(SM.el('div', { class: 'stat-row' },
          SM.el('span', { class: 'stat-label' }, rt.name + (rt.fallback ? ' (fallback)' : '')),
          SM.el('span', { class: 'stat-value', style: { color: rt.status === 'active' ? '#34D399' : 'var(--sm-muted)' } }, rt.trigger)
        ));
      }
      el.appendChild(routinePanel);
    }

    if (agents.queue && agents.queue.length) {
      var queuePanel = SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Ops Queue (' + agents.queue.length + ' open)')
      );
      for (var i = 0; i < agents.queue.length; i++) {
        var issue = agents.queue[i];
        var labels = issue.labels.join(', ');
        var issueUrl = 'https://github.com/Moddable-Games/moddable-ops/issues/' + issue.number;
        queuePanel.appendChild(SM.el('div', { class: 'stat-row' },
          SM.el('a', { class: 'stat-label', href: issueUrl, target: '_blank', rel: 'noopener', style: { color: 'var(--sm-text)', textDecoration: 'none' } }, '#' + issue.number + ' ' + issue.title),
          SM.el('span', { class: 'stat-value', style: { fontSize: '11px' } }, labels)
        ));
      }
      el.appendChild(queuePanel);
    }

    if (runs.history && runs.history.length) {
      var histPanel = SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Recent Routine Runs')
      );
      var recent = runs.history.slice(-5).reverse();
      for (var i = 0; i < recent.length; i++) {
        var h = recent[i];
        var color = h.quality === 'pass' ? '#34D399' : h.quality === 'partial' ? 'var(--sm-gold-glow)' : '#EF4444';
        histPanel.appendChild(SM.el('div', { class: 'stat-row' },
          SM.el('span', { class: 'stat-label' }, h.date + ' — ' + h.routine),
          SM.el('span', { class: 'stat-value', style: { color: color } }, h.quality)
        ));
      }
      el.appendChild(histPanel);
    }
  }

  function renderEcosystem(eco) {
    var el = document.getElementById('ecosystem-content');
    var grid = SM.el('div', { class: 'dashboard-grid-3' });

    grid.appendChild(statPanel('Games', [
      { label: 'Total', value: String(eco.games.total) },
      { label: 'Live', value: String(eco.games.live) },
      { label: 'Development', value: String(eco.games.development) },
      { label: 'Playtest', value: String(eco.games.playtest) }
    ]));

    var engineRows = eco.engines.map(function(e) {
      return { label: e.name || 'Engine', value: e.version || '—' };
    });
    if (!engineRows.length) engineRows = [{ label: 'No engine data', value: '—' }];
    grid.appendChild(statPanel('Engine Stack', engineRows));

    if (eco.rules) {
      grid.appendChild(statPanel('Rules Library', [
        { label: 'Game families', value: String(eco.rules.families) },
        { label: 'Variant rules', value: String(eco.rules.variants) },
        { label: 'Rulebooks', value: String(eco.rules.rulebooks) },
        { label: 'Generated PDFs', value: String(eco.rules.pdfs) },
        { label: 'Search index entries', value: String(eco.rules.index_entries) }
      ]));
    }

    el.appendChild(grid);

    if (eco.convergence) {
      var c = eco.convergence;
      var convGrid = SM.el('div', { class: 'dashboard-grid-2', style: { marginTop: '24px' } });
      convGrid.appendChild(statPanel('Unified Engine — Convergence', [
        { label: 'Engine plugins', value: String(c.engine_plugins) + ' / ' + c.target_total + ' (' + c.pct + '%)' },
        { label: 'Rules families', value: String(c.rules_families) + ' to support' },
        { label: 'Chess variants', value: String(c.chess_variants) + ' to port' },
        { label: 'Hex games', value: String(c.hex_games) + ' to port' },
        { label: 'Commits this week', value: String(c.commits_this_week) },
        { label: 'Commits this month', value: String(c.commits_this_month) }
      ]));
      var barMax = Math.max(c.rules_families, c.chess_variants, c.hex_games);
      var barItems = [
        { label: 'rules (' + c.rules_families + ')', value: c.rules_families, accent: 'gold' },
        { label: 'chess (' + c.chess_variants + ')', value: c.chess_variants, accent: 'teal' },
        { label: 'hex (' + c.hex_games + ')', value: c.hex_games, accent: 'violet' },
        { label: 'plugins (' + c.engine_plugins + ')', value: c.engine_plugins, accent: 'muted' }
      ];
      var rightPanel = SM.el('div', { class: 'dashboard-panel' },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Target vs Engine Plugins'),
        barChart(barItems, barMax)
      );
      var phase = SM.el('div', { class: 'stat-row', style: { borderBottom: 'none', paddingTop: '16px' } },
        SM.el('span', { class: 'stat-label' }, 'Current phase'),
        SM.el('span', { class: 'stat-value', style: { color: 'var(--sm-gold-glow)', fontSize: '12px' } }, 'Board Studio')
      );
      rightPanel.appendChild(phase);
      var note = SM.el('div', { style: { fontFamily: 'var(--f-body)', fontSize: '11px', color: 'var(--sm-muted)', marginTop: '8px', lineHeight: '1.5' } },
        'Gap will grow as moddable-rules expands. Playable games begin after board generation is complete.'
      );
      rightPanel.appendChild(note);
      convGrid.appendChild(rightPanel);
      el.appendChild(convGrid);
    }
  }

  function renderGitHub(gh) {
    var el = document.getElementById('github-content');
    var grid = SM.el('div', { class: 'dashboard-grid-2' });

    var repoRows = gh.repos.map(function(r) {
      return { label: r.repo, value: r.open_issues + ' issues' + (r.stars ? ', ' + r.stars + '★' : '') };
    });
    grid.appendChild(statPanel('Repositories (' + gh.repos.length + ')', repoRows));
    grid.appendChild(statPanel('Summary', [
      { label: 'Total open issues', value: String(gh.total_open_issues) },
      { label: 'Total stars', value: String(gh.total_stars) }
    ]));
    el.appendChild(grid);

    if (gh.issues && gh.issues.length) {
      var table = SM.el('table', { class: 'metrics-table' });
      table.appendChild(SM.el('thead', {},
        SM.el('tr', {},
          SM.el('th', {}, 'Repo'), SM.el('th', {}, '#'),
          SM.el('th', {}, 'Title'), SM.el('th', {}, 'Labels')
        )
      ));
      var tbody = SM.el('tbody');
      for (var i = 0; i < Math.min(gh.issues.length, 20); i++) {
        var issue = gh.issues[i];
        var titleCell = issue.url
          ? SM.el('td', {}, SM.el('a', { href: issue.url, target: '_blank', rel: 'noopener', style: { color: 'var(--sm-text)', textDecoration: 'none' } }, issue.title))
          : SM.el('td', {}, issue.title);
        var labelsCell = SM.el('td', { style: { textAlign: 'right' } });
        for (var j = 0; j < issue.labels.length; j++) {
          var lbl = issue.labels[j];
          var name = typeof lbl === 'string' ? lbl : lbl.name;
          var color = (typeof lbl === 'object' && lbl.color) ? '#' + lbl.color : 'var(--sm-muted)';
          var textColor = isLightColor(color) ? '#1a1a2e' : '#ffffff';
          labelsCell.appendChild(SM.el('span', { class: 'gh-label', style: { background: color, color: textColor } }, name));
        }
        tbody.appendChild(SM.el('tr', {},
          SM.el('td', { style: { fontFamily: 'var(--f-mono)', fontSize: '11px' } }, issue.repo),
          SM.el('td', {}, '#' + issue.number),
          titleCell,
          labelsCell
        ));
      }
      table.appendChild(tbody);
      el.appendChild(SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, 'All Open Issues (most recent)'),
        table
      ));
    }
  }

  function renderCloudflare(cf, analytics) {
    var el = document.getElementById('cloudflare-content');
    if (cf.error) {
      el.appendChild(SM.el('p', { style: { color: 'var(--sm-muted)' } }, 'Error: ' + cf.error));
      return;
    }

    var cfLink = SM.el('a', { href: 'https://dash.cloudflare.com/52066e47a6c7b705baee636a1dff5387/workers/overview', target: '_blank', rel: 'noopener', class: 'dashboard-external-link' }, 'Open Cloudflare Dashboard →');
    el.appendChild(cfLink);

    var grid = SM.el('div', { class: 'dashboard-grid-2' });
    grid.appendChild(statPanel('Workers (7d)', [
      { label: 'Total requests', value: cf.total_requests.toLocaleString() },
      { label: 'Total errors', value: String(cf.total_errors) },
      { label: 'Error rate', value: (cf.error_rate * 100).toFixed(2) + '%' }
    ]));

    if (cf.by_worker && cf.by_worker.length) {
      var maxReq = cf.by_worker[0].requests;
      var items = cf.by_worker.map(function(w) {
        return { label: w.name, value: w.requests, accent: w.errors > 0 ? 'red' : 'teal' };
      });
      grid.appendChild(SM.el('div', { class: 'dashboard-panel' },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Requests by Worker'),
        barChart(items, maxReq)
      ));
    }
    el.appendChild(grid);

    // MCP Tool usage from GA4 events (moddable-tools Worker serves these)
    var mgEvents = analytics && analytics.moddable_games && analytics.moddable_games.events_30d;
    if (mgEvents && mgEvents.length) {
      var toolEvents = mgEvents.filter(function(e) {
        return e.event === 'tool_call' || e.event.includes('game_') || e.event.includes('puzzle') || e.event.includes('hex_') || e.event.includes('dice_') || e.event.includes('deck_') || e.event.includes('faction') || e.event.includes('pdf_') || e.event.includes('file_');
      });
      if (toolEvents.length) {
        var teMax = toolEvents[0].count;
        var teItems = toolEvents.map(function(e) {
          var accent = e.event.includes('game') ? 'violet' : e.event.includes('tool') ? 'teal' : 'gold';
          return { label: e.event, value: e.count, accent: accent };
        });
        el.appendChild(SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
          SM.el('div', { class: 'dashboard-panel-title' }, 'Tool & Game Events via GA4 (30d)'),
          barChart(teItems, teMax)
        ));
      }
    }
  }

  function renderInvestment(inv) {
    var el = document.getElementById('investment-content');
    if (inv.applications && inv.applications.length) {
      for (var i = 0; i < inv.applications.length; i++) {
        var app = inv.applications[i];
        var card = SM.el('div', { class: 'investment-card', 'data-status': app.status },
          SM.el('div', { class: 'investment-name' }, app.name),
          SM.el('div', { class: 'investment-status', 'data-status': app.status }, app.status),
          SM.el('div', { class: 'investment-notes' }, app.angle || app.notes || '')
        );
        el.appendChild(card);
      }
    }
    if (inv.status_summary) {
      el.appendChild(SM.el('p', { style: { color: 'var(--sm-muted)', fontSize: '13px', marginTop: '16px' } }, inv.status_summary));
    }
  }
})();

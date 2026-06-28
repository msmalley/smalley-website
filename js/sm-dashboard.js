(function() {
  var snapshotUrl = SM.url('/dashboard/data/snapshot.json?v=' + SM.VERSION);

  fetch(snapshotUrl).then(function(r) { return r.json(); }).then(render).catch(function(e) {
    document.getElementById('dashboard-meta').textContent = 'Failed to load snapshot: ' + e.message;
  });

  function render(data) {
    renderMeta(data._meta);
    renderIndicators(data.indicators);
    if (data.employment) renderEmployment(data.employment);
    if (data.social) renderSocial(data.social);
    if (data.analytics) renderAnalytics(data.analytics);
    if (data.agents) renderAgents(data.agents);
    if (data.github) renderGitHub(data.github);
    if (data.cloudflare) renderCloudflare(data.cloudflare);
    if (data.ecosystem) renderEcosystem(data.ecosystem);
    if (data.investment) renderInvestment(data.investment);
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
      var leadsPanel = SM.el('div', { class: 'dashboard-panel', style: { marginTop: '24px' } },
        SM.el('div', { class: 'dashboard-panel-title' }, 'Top Actionable Leads')
      );
      for (var i = 0; i < emp.top_leads.length; i++) {
        var lead = emp.top_leads[i];
        var cardAttrs = { class: 'lead-card' };
        if (lead.url) {
          cardAttrs = { class: 'lead-card lead-card-link', href: lead.url, target: '_blank', rel: 'noopener' };
        }
        var tag = lead.url ? 'a' : 'div';
        leadsPanel.appendChild(SM.el(tag, cardAttrs,
          SM.el('div', { class: 'lead-info' },
            SM.el('div', { class: 'lead-role' }, lead.role),
            SM.el('div', { class: 'lead-company' }, lead.company + ' · ' + (lead.variant || '') + (lead.days_old != null ? ' · ' + lead.days_old + 'd ago' : ''))
          ),
          SM.el('div', { class: 'lead-score' }, String(lead.score))
        ));
      }
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

  function renderCloudflare(cf) {
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

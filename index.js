app.get('/repos/public/html', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('<p>Unauthorized</p>');
  }

  try {
    const response = await axios.get('https://gitlab.com/api/v4/projects', {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
      params: { visibility: 'public' },
    });

    const renderedHTML = response.data.map(repo => `
      <div class="repo-item">
        <h3>${repo.name}</h3>
        <p><strong>Description:</strong> ${repo.description || 'No description available'}</p>
        <p><strong>Visibility:</strong> ${repo.visibility}</p>
        <a href="${repo.web_url}" target="_blank">View on GitLab</a>
      </div>
    `).join('');
    
    res.send(renderedHTML);
  } catch (error) {
    res.status(500).send('<p>Failed to fetch public repositories</p>');
  }
});

app.get('/repos/private/html', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('<p>Unauthorized</p>');
  }

  try {
    const response = await axios.get('https://gitlab.com/api/v4/projects', {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
      params: { visibility: 'private' },
    });

    const renderedHTML = response.data.map(repo => `
      <div class="repo-item">
        <h3>${repo.name}</h3>
        <p><strong>Description:</strong> ${repo.description || 'No description available'}</p>
        <p><strong>Visibility:</strong> ${repo.visibility}</p>
        <a href="${repo.web_url}" target="_blank">View on GitLab</a>
      </div>
    `).join('');
    
    res.send(renderedHTML);
  } catch (error) {
    res.status(500).send('<p>Failed to fetch private repositories</p>');
  }
});

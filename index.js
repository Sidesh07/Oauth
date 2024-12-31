require('dotenv').config();
const express = require('express');
const passport = require('passport');
const GitLabStrategy = require('passport-gitlab2').Strategy;
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Passport configuration
passport.use(
  new GitLabStrategy(
    {
      clientID: process.env.GITLAB_CLIENT_ID,
      clientSecret: process.env.GITLAB_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/gitlab/callback',
      scope: ['read_api'],
    },
    (accessToken, refreshToken, profile, done) => {
      profile.accessToken = accessToken;
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Middleware setup
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/auth/gitlab', passport.authenticate('gitlab'));

app.get(
  '/auth/gitlab/callback',
  passport.authenticate('gitlab', { failureRedirect: '/' }),
  (req, res) => res.redirect('/profile')
);

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Fetch repositories
const renderRepoHTML = (repos) => {
  return repos.map(repo => `
    <div class="repo-item">
      <h3>${repo.name}</h3>
      <p><strong>Description:</strong> ${repo.description || 'No description available'}</p>
      <p><strong>Visibility:</strong> ${repo.visibility}</p>
      <button onclick="fetchRepoFiles(${repo.id})">Show Files</button>
      <button onclick="cloneRepo('${repo.ssh_url_to_repo}')">Clone Repository</button>
      <a href="/repos/${repo.id}/download" class="download-button">Download Repository</a>
      <a href="${repo.web_url}" target="_blank">View on GitLab</a>
    </div>
  `).join('');
};

app.get('/repos/public/html', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('<p>Unauthorized</p>');

  try {
    const response = await axios.get('https://gitlab.com/api/v4/projects', {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
      params: { owned: true },
    });

    const publicRepos = response.data.filter(repo => repo.visibility === 'public');
    res.send(renderRepoHTML(publicRepos));
  } catch (error) {
    console.error('Error fetching public repositories:', error.message);
    res.status(500).send('<p>Failed to fetch public repositories</p>');
  }
});

app.get('/repos/private/html', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('<p>Unauthorized</p>');

  try {
    const response = await axios.get('https://gitlab.com/api/v4/projects', {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
      params: { owned: true },
    });

    const privateRepos = response.data.filter(repo => repo.visibility === 'private');
    res.send(renderRepoHTML(privateRepos));
  } catch (error) {
    console.error('Error fetching private repositories:', error.message);
    res.status(500).send('<p>Failed to fetch private repositories</p>');
  }
});

// Fetch files in a repository
app.get('/repos/:id/files', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('<p>Unauthorized</p>');

  const repoId = req.params.id;

  try {
    const response = await axios.get(`https://gitlab.com/api/v4/projects/${repoId}/repository/tree`, {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
    });

    const renderedHTML = response.data.map(file => `
      <div class="file-item">
        <p><strong>${file.type}:</strong> ${file.name}</p>
      </div>
    `).join('');
    res.send(renderedHTML);
  } catch (error) {
    console.error('Error fetching files:', error.message);
    res.status(500).send('<p>Failed to fetch files for this repository</p>');
  }
});

// Download repository archive
app.get('/repos/:id/download', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('<p>Unauthorized</p>');

  const repoId = req.params.id;

  try {
    const response = await axios.get(`https://gitlab.com/api/v4/projects/${repoId}/repository/archive`, {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
      responseType: 'stream',
    });

    res.setHeader('Content-Disposition', `attachment; filename="${repoId}.zip"`);
    response.data.pipe(res);
  } catch (error) {
    console.error('Error downloading repository archive:', error.message);
    res.status(500).send('<p>Failed to download repository archive</p>');
  }
});

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

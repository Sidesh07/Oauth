// Load environment variables
require('dotenv').config();

const express = require('express');
const passport = require('passport');
const GitLabStrategy = require('passport-gitlab2').Strategy;
const session = require('express-session');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Configure Passport for GitLab OAuth
passport.use(
  new GitLabStrategy(
    {
      clientID: process.env.GITLAB_CLIENT_ID,
      clientSecret: process.env.GITLAB_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/gitlab/callback',
      scope: ['read_api'], // Ensure proper scope for repository access
    },
    (accessToken, refreshToken, profile, done) => {
      profile.accessToken = accessToken; // Attach access token to the user profile
      return done(null, profile);
    }
  )
);

// Serialize and deserialize user information for sessions
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Middleware setup
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth/gitlab', passport.authenticate('gitlab'));

app.get(
  '/auth/gitlab/callback',
  passport.authenticate('gitlab', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/profile');
  }
);

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Public repositories
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
    console.error('Error fetching public repositories:', error.response?.data || error.message);
    res.status(500).send('<p>Failed to fetch public repositories</p>');
  }
});

// Private repositories
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
    console.error('Error fetching private repositories:', error.response?.data || error.message);
    res.status(500).send('<p>Failed to fetch private repositories</p>');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const app = express();
const PORT = 3000;

// Set up PostgreSQL connection pool
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "BlogDB",
  password: process.env.DB_PASSWORD,
  port: 5432,
});

// Setup
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

//Makes 'user' available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// sends people to sign in page if they are not logged in
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/signin");
  }
    next();
}

  app.get("/signup", (req, res) => {
    res.render("signup", { error: null });
  });

  app.post("/signup", async (req, res) => {
    const { user_id, password, name } = req.body;
    try {
      const existing = await pool.query("SELECT * FROM users WHERE user_id = $1", [user_id]);
      if (existing.rows.length > 0) {
        return res.render("signup", { error: "User ID already exists" });
      }

      await pool.query("INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)", [user_id, password, name]);
      res.redirect("/signin");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  // Sign in route
  app.get("/signin", (req, res) => {
    res.render("signin", { error: null });
  });

  app.post("/signin", async (req, res) => {
    const { user_id, password } = req.body;
    try {
      const result = await pool.query("SELECT * FROM users WHERE user_id = $1 AND password = $2", [user_id, password]);
      if (result.rows.length === 0) {
        return res.render("signin", { error: "Invalid user ID or password" });
      }

      req.session.user = { user_id: result.rows[0].user_id, name: result.rows[0].name };
      res.redirect("/");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  app.post("/signout", (req, res) => {
    req.session.destroy(() => res.redirect("/signin"));
  });

  //view all posts
  app.get("/", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM blogs ORDER BY date_created DESC");
      res.render("stuff", { posts: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  //create a new post
  app.post("/posts", requireLogin, async(req, res) => {
    const { title, content } = req.body;
    try {
      await pool.query("INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created) VALUES ($1, $2, $3, $4, NOW())", [req.session.user.name, req.session.user.user_id, title, content]);
      res.redirect("/");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  //edit a post
  app.get("/posts/:id/edit", requireLogin, async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM blogs WHERE blog_id = $1", [req.params.id]);
      const post = result.rows[0];
      if (!post) {
        return res.status(404).send("Post not found");
      }
      
      if (post.creator_user_id !== req.session.user.user_id) {
        return res.status(403).send("You are not authorized to edit this post");
      }
      res.render("edit", { post });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  app.post("/posts/:id/update", requireLogin, async (req, res) => {
    const { title, content } = req.body;
    try {
      const result = await pool.query("UPDATE blogs SET title = $1, body = $2 WHERE blog_id = $3 AND creator_user_id = $4", [title, content, req.params.id, req.session.user.user_id]);
      if (result.rowCount === 0) {
        return res.status(403).send("You are not authorized to update this post");
      }
      res.redirect("/");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  //delete a post
  app.post("/posts/:id/delete", requireLogin, async (req, res) => {
    try {
      const result = await pool.query("DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2", [req.params.id, req.session.user.user_id]);
      if (result.rowCount === 0) {
        return res.status(403).send("You are not authorized to delete this post");
      }
      res.redirect("/");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

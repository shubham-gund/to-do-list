import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import session from "express-session";
import dotenv from 'dotenv';
dotenv.config();


const app = express();
const PORT = 3000;
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Connect to pg
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "todolist",
  password: process.env.password,
  port: 5432,
});
db.connect();

// Handle GET request for the registration form
app.get('/', (req, res) => {
  res.render(__dirname + '/views/register.ejs');
});

// Handle POST request for user registration
app.post('/register', async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    if (!name || !email || !password) {
      console.log("Please fill out all fields");
      res.redirect('/rerror');
      return; 
    }

    const existingUser = await db.query("select email from users where email=$1", [email]);
    if (existingUser.rows.length === 0) {
      await db.query("insert into users values($1,$2,$3)", [email, name, password]);
      //to access email
      req.session.email = email;

      res.redirect("/login");
    } else {
      console.log("User already exists ");
      res.redirect('/rerror');
    }
  } catch (error) {
    console.log(error);
    res.redirect("/rerror");
  }
});

// Handle POST request for Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (existingUser.rows.length === 0) {
      // User does not exist
      res.redirect("/error");
    } else {
      const storedPassword = existingUser.rows[0].password;
      if (password === storedPassword) {
        // Passwords match, user is logged in
        req.session.email = email; //email is set in the session
        res.redirect("/todolist");
      } else {
        // Passwords do not match
        console.log("Incorrect password");
        res.redirect("/error");
      }
    }
  } catch (error) {
    console.log(error);
    res.redirect("/error");
  }
});

// get login
app.get('/login', (req, res) => {
  res.render(__dirname + '/views/login.ejs');
});

// get registration error
app.get('/rerror', (req, res) => {
  res.render(__dirname + '/views/registrationError.ejs');
});

// get login error
app.get('/error', (req, res) => {
  res.render(__dirname + '/views/loginError.ejs');
});

app.get("/todolist", async (req, res) => {
  try {
    if (!req.session.email) {
      // If email is not set in the session, redirect to login
      res.redirect("/login");
      return;
    }

    const result = await db.query("SELECT * FROM items WHERE email = $1 ORDER BY id ASC", [req.session.email]);
    const items = result.rows;
    res.setHeader('Cache-Control', 'no-store'); // Disable caching
    res.render(__dirname + "/views/todolist.ejs", {
      listTitle: "Today",
      listItems: items,
    });
  } catch (err) {
    console.log(err);
  }
});

app.post("/add", async (req, res) => {
  const item = req.body.newItem;
  // items.push({title: item});
  try {
    await db.query("INSERT INTO items (title, email) VALUES ($1, $2)", [item, req.session.email]);
    res.redirect("/todolist");
  } catch (err) {
    console.log(err);
  }
});

app.post("/edit", async (req, res) => {
  const item = req.body.updatedItemTitle;
  const id = req.body.updatedItemId;

  try {
    await db.query("UPDATE items SET title = $1 WHERE id = $2 AND email = $3", [item, id, req.session.email]);
    res.redirect("/todolist");
  } catch (err) {
    console.log(err);
  }
});

app.post("/delete", async (req, res) => {
  const id = req.body.deleteItemId;
  try {
    await db.query("DELETE FROM items WHERE id = $1 AND email = $2", [id, req.session.email]);
    res.redirect("/todolist");
  } catch (err) {
    console.log(err);
  }
});

// handle logout
app.get('/logout', (req, res) => {
  // Clear the session and redirect to the login page
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect('/');
    }
  });
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

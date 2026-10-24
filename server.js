const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const DATA_FILE = "./data.json";

function readData() {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!data.users) data.users = [];
    if (!data.expenses) data.expenses = [];
    if (!data.groups) data.groups = [];

    return data;
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* =========================
   PASSWORD HASHING
========================= */

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    const [salt, storedHash] = storedPassword.split(":");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return hash === storedHash;
}

/* =========================
   SIMPLE SESSION SYSTEM
========================= */

const sessions = {};

/* =========================
   AUTH MIDDLEWARE
========================= */

function authenticate(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Please login first"
        });
    }

    const token = authHeader.replace("Bearer ", "");

    const userId = sessions[token];

    if (!userId) {
        return res.status(401).json({
            message: "Invalid or expired session"
        });
    }

    req.userId = userId;

    next();
}

/* =========================
   SIGN UP
========================= */

app.post("/api/auth/signup", (req, res) => {

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: "Password must be at least 6 characters"
        });
    }

    const data = readData();

    const existingUser = data.users.find(
        user => user.email.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
        return res.status(400).json({
            message: "Email already registered"
        });
    }

    const user = {
        id: Date.now(),
        name,
        email,
        password: hashPassword(password)
    };

    data.users.push(user);

    /*
       If this is the first user, assign old demo
       data to this account.
    */
    if (data.users.length === 1) {

        data.expenses.forEach(expense => {
            if (!expense.userId) {
                expense.userId = user.id;
            }
        });

        data.groups.forEach(group => {
            if (!group.userId) {
                group.userId = user.id;
            }
        });
    }

    saveData(data);

    const token = crypto.randomBytes(32).toString("hex");

    sessions[token] = user.id;

    res.status(201).json({
        message: "Account created successfully",
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }
    });
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    const data = readData();

    const user = data.users.find(
        user => user.email.toLowerCase() === email.toLowerCase()
    );

    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const token = crypto.randomBytes(32).toString("hex");

    sessions[token] = user.id;

    res.json({
        message: "Login successful",
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }
    });
});

/* =========================
   CURRENT USER
========================= */

app.get("/api/auth/me", authenticate, (req, res) => {

    const data = readData();

    const user = data.users.find(
        user => user.id === req.userId
    );

    if (!user) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    res.json({
        id: user.id,
        name: user.name,
        email: user.email
    });
});

/* =========================
   LOGOUT
========================= */

app.post("/api/auth/logout", authenticate, (req, res) => {

    const token = req.headers.authorization.replace("Bearer ", "");

    delete sessions[token];

    res.json({
        message: "Logged out successfully"
    });
});

/* =========================
   EXPENSES
========================= */

app.get("/api/expenses", authenticate, (req, res) => {

    const data = readData();

    const expenses = data.expenses.filter(
        expense => expense.userId === req.userId
    );

    res.json(expenses);
});

app.post("/api/expenses", authenticate, (req, res) => {

    const data = readData();

    const expense = {
        id: Date.now(),
        userId: req.userId,
        description: req.body.description,
        amount: Number(req.body.amount),
        category: req.body.category,
        type: req.body.type,
        groupId: req.body.groupId || null,
        paidBy: req.body.paidBy || null,
        participants: req.body.participants || [],
        date: new Date().toISOString()
    };

    data.expenses.push(expense);

    saveData(data);

    res.status(201).json(expense);
});

/* =========================
   GROUPS
========================= */

app.get("/api/groups", authenticate, (req, res) => {

    const data = readData();

    const groups = data.groups.filter(
        group => group.userId === req.userId
    );

    res.json(groups);
});

app.post("/api/groups", authenticate, (req, res) => {

    const data = readData();

    const group = {
        id: Date.now(),
        userId: req.userId,
        name: req.body.name,
        members: req.body.members
    };

    data.groups.push(group);

    saveData(data);

    res.status(201).json(group);
});

/* =========================
   GROUP DETAILS
========================= */

app.get("/api/groups/:id", authenticate, (req, res) => {

    const data = readData();

    const groupId = Number(req.params.id);

    const group = data.groups.find(
        group =>
            group.id === groupId &&
            group.userId === req.userId
    );

    if (!group) {
        return res.status(404).json({
            message: "Group not found"
        });
    }

    const expenses = data.expenses.filter(
        expense =>
            expense.groupId === groupId &&
            expense.userId === req.userId
    );

    res.json({
        group,
        expenses
    });
});

/* =========================
   SETTLEMENT
========================= */

app.get("/api/groups/:id/settlement", authenticate, (req, res) => {

    const data = readData();

    const groupId = Number(req.params.id);

    const group = data.groups.find(
        group =>
            group.id === groupId &&
            group.userId === req.userId
    );

    if (!group) {
        return res.status(404).json({
            message: "Group not found"
        });
    }

    const expenses = data.expenses.filter(
        expense =>
            expense.groupId === groupId &&
            expense.userId === req.userId
    );

    const balances = {};

    group.members.forEach(member => {
        balances[member] = 0;
    });

    expenses.forEach(expense => {

        const participants =
            expense.participants.length > 0
                ? expense.participants
                : group.members;

        const share = expense.amount / participants.length;

        if (
            expense.paidBy &&
            balances[expense.paidBy] !== undefined
        ) {
            balances[expense.paidBy] += expense.amount;
        }

        participants.forEach(member => {

            if (balances[member] !== undefined) {
                balances[member] -= share;
            }

        });

    });

    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([person, balance]) => {

        if (balance > 0.01) {

            creditors.push({
                person,
                amount: balance
            });

        } else if (balance < -0.01) {

            debtors.push({
                person,
                amount: Math.abs(balance)
            });

        }

    });

    const settlements = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {

        const debtor = debtors[i];
        const creditor = creditors[j];

        const amount = Math.min(
            debtor.amount,
            creditor.amount
        );

        settlements.push({
            from: debtor.person,
            to: creditor.person,
            amount: Number(amount.toFixed(2))
        });

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) i++;

        if (creditor.amount < 0.01) j++;
    }

    res.json({
        balances,
        settlements
    });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {

    console.log(
        `🚀 Plan_My_Pocket running at http://localhost:${PORT}`
    );

});
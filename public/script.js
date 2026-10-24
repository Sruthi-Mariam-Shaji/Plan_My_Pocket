/* =========================================
   PLAN_MY_POCKET
   COMPLETE FRONTEND SCRIPT
========================================= */


/* =========================================
   AUTHENTICATION
========================================= */

const token = localStorage.getItem("planMyPocketToken");

if (!token) {
    window.location.href = "login.html";
}

const currentUser = JSON.parse(
    localStorage.getItem("planMyPocketUser") || "null"
);

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function handleUnauthorized() {
    localStorage.removeItem("planMyPocketToken");
    localStorage.removeItem("planMyPocketUser");
    window.location.href = "login.html";
}


/* =========================================
   GLOBAL VARIABLES
========================================= */

let expenses = [];
let groups = [];
let currentGroup = null;


/* =========================================
   USER NAME
========================================= */

const userNameElement = document.getElementById("userName");

if (userNameElement && currentUser) {
    userNameElement.textContent = `Hi, ${currentUser.name} 👋`;
}


/* =========================================
   LOGOUT
========================================= */

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {

        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: authHeaders()
            });
        } catch (error) {
            console.log("Logout error:", error);
        }

        localStorage.removeItem("planMyPocketToken");
        localStorage.removeItem("planMyPocketUser");

        window.location.href = "login.html";
    });
}


/* =========================================
   LOAD EXPENSES
========================================= */

async function loadExpenses() {

    try {

        const response = await fetch("/api/expenses", {
            headers: authHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load expenses");
        }

        expenses = await response.json();

        updateDashboard();
        displayExpenses();
        displayCategorySummary();

    } catch (error) {

        console.error("Error loading expenses:", error);

    }
}


/* =========================================
   LOAD GROUPS
========================================= */

async function loadGroups() {

    try {

        const response = await fetch("/api/groups", {
            headers: authHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load groups");
        }

        groups = await response.json();

        displayGroups();
        updateDashboard();

    } catch (error) {

        console.error("Error loading groups:", error);

    }
}


/* =========================================
   DASHBOARD
========================================= */

function updateDashboard() {

    const totalSpent = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
    );

    const personalSpent = expenses
        .filter(expense => expense.type === "personal")
        .reduce(
            (sum, expense) => sum + Number(expense.amount || 0),
            0
        );

    const groupSpent = expenses
        .filter(expense => expense.type === "group")
        .reduce(
            (sum, expense) => sum + Number(expense.amount || 0),
            0
        );


    const totalElement = document.getElementById("totalSpent");
    const personalElement = document.getElementById("personalSpent");
    const groupElement = document.getElementById("groupSpent");
    const groupCountElement = document.getElementById("groupCount");


    if (totalElement) {
        totalElement.textContent = `₹${totalSpent.toFixed(2)}`;
    }

    if (personalElement) {
        personalElement.textContent = `₹${personalSpent.toFixed(2)}`;
    }

    if (groupElement) {
        groupElement.textContent = `₹${groupSpent.toFixed(2)}`;
    }

    if (groupCountElement) {
        groupCountElement.textContent = groups.length;
    }
}


/* =========================================
   ADD EXPENSE
========================================= */

/* =========================================
   ADD EXPENSE
========================================= */

const expenseForm = document.getElementById("expenseForm");

if (expenseForm) {

    expenseForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        // Get fields directly from the form
        const inputs = expenseForm.querySelectorAll("input");
        const selects = expenseForm.querySelectorAll("select");

        const description = inputs[0]?.value.trim();
        const amount = inputs[1]?.value;
        const category = selects[0]?.value;
        const type = selects[1]?.value;

        console.log("Expense data:", {
            description,
            amount,
            category,
            type
        });

        if (!description || !amount) {
            alert("Please enter description and amount.");
            return;
        }

        try {

            const response = await fetch("/api/expenses", {

                method: "POST",

                headers: authHeaders(),

                body: JSON.stringify({
                    description: description,
                    amount: Number(amount),
                    category: category,
                    type: type
                })

            });

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();

                alert(
                    errorData.message ||
                    "Could not add expense."
                );

                return;
            }

            // Clear the form
            expenseForm.reset();

            // Reload dashboard
            await loadExpenses();

            alert("Expense added successfully! 🎉");

        } catch (error) {

            console.error(
                "Error adding expense:",
                error
            );

            alert(
                "Something went wrong while adding the expense."
            );

        }

    });
}

/* =========================================
   DISPLAY EXPENSES
========================================= */

function displayExpenses() {

    const expenseList =
        document.getElementById("expenseList");

    if (!expenseList) return;


    if (expenses.length === 0) {

        expenseList.innerHTML = `
            <div class="empty-state">
                No expenses yet.
            </div>
        `;

        return;
    }


    const recentExpenses = [...expenses]
        .sort(
            (a, b) =>
                new Date(b.date) - new Date(a.date)
        )
        .slice(0, 10);


    expenseList.innerHTML = recentExpenses
        .map(expense => {

            let icon = "💰";


            if (expense.category === "Food") {
                icon = "🍔";
            }

            else if (expense.category === "Travel") {
                icon = "🚗";
            }

            else if (expense.category === "Shopping") {
                icon = "🛍️";
            }

            else if (expense.category === "Entertainment") {
                icon = "🎬";
            }


            return `
                <div class="expense-item">

                    <div class="expense-icon">
                        ${icon}
                    </div>

                    <div class="expense-info">

                        <strong>
                            ${escapeHTML(expense.description)}
                        </strong>

                        <span>
                            ${escapeHTML(expense.category || "Other")}
                            •
                            ${escapeHTML(expense.type || "personal")}
                        </span>

                    </div>

                    <div class="expense-amount">
                        ₹${Number(expense.amount).toFixed(2)}
                    </div>

                </div>
            `;

        })
        .join("");
}


/* =========================================
   CATEGORY SUMMARY
========================================= */

function displayCategorySummary() {

    const container =
        document.getElementById("categorySummary");

    if (!container) return;


    const categories = {};


    expenses.forEach(expense => {

        const category =
            expense.category || "Other";

        categories[category] =
            (categories[category] || 0) +
            Number(expense.amount || 0);

    });


    const total = expenses.reduce(
        (sum, expense) =>
            sum + Number(expense.amount || 0),
        0
    );


    if (Object.keys(categories).length === 0) {

        container.innerHTML = `
            <p class="empty-state">
                No category data yet.
            </p>
        `;

        return;
    }


    container.innerHTML =
        Object.entries(categories)
            .map(([category, amount]) => {

                const percentage =
                    total > 0
                        ? (amount / total) * 100
                        : 0;


                return `
                    <div class="category-row">

                        <div class="category-label">

                            <span>
                                ${escapeHTML(category)}
                            </span>

                            <strong>
                                ₹${amount.toFixed(2)}
                            </strong>

                        </div>

                        <div class="category-bar">

                            <div
                                class="category-fill"
                                style="width: ${percentage}%"
                            ></div>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================
   CREATE GROUP
========================================= */

/* =========================================
   CREATE GROUP
========================================= */

const groupForm = document.getElementById("groupForm");

if (groupForm) {

    groupForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        // Get inputs directly from the group form
        const inputs = groupForm.querySelectorAll("input");

        const name = inputs[0]?.value.trim();
        const membersText = inputs[1]?.value.trim();

        console.log("Group data:", {
            name,
            membersText
        });

        if (!name || !membersText) {

            alert("Please enter group name and members.");

            return;
        }


        const members = membersText
            .split(",")
            .map(member => member.trim())
            .filter(member => member.length > 0);


        if (members.length < 2) {

            alert(
                "A group needs at least 2 members."
            );

            return;
        }


        try {

            const response = await fetch("/api/groups", {

                method: "POST",

                headers: authHeaders(),

                body: JSON.stringify({

                    name: name,

                    members: members

                })

            });


            if (response.status === 401) {

                handleUnauthorized();

                return;
            }


            if (!response.ok) {

                const errorData =
                    await response.json();

                alert(
                    errorData.message ||
                    "Could not create group."
                );

                return;
            }


            // Clear the form
            groupForm.reset();


            // Reload groups
            await loadGroups();


            alert("Group created successfully! 🎉");


        } catch (error) {

            console.error(
                "Error creating group:",
                error
            );

            alert(
                "Something went wrong while creating the group."
            );

        }

    });

}

/* =========================================
   DISPLAY GROUPS
========================================= */

function displayGroups() {

    const groupList =
        document.getElementById("groupList");

    if (!groupList) return;


    if (groups.length === 0) {

        groupList.innerHTML = `
            <div class="empty-state">
                No groups created yet.
            </div>
        `;

        return;
    }


    groupList.innerHTML = groups
        .map(group => {

            const groupExpenses =
                expenses.filter(
                    expense =>
                        Number(expense.groupId) ===
                        Number(group.id)
                );


            const total =
                groupExpenses.reduce(
                    (sum, expense) =>
                        sum + Number(expense.amount || 0),
                    0
                );


            return `
                <div class="group-card">

                    <div class="group-card-header">

                        <div>

                            <h3>
                                ${escapeHTML(group.name)}
                            </h3>

                            <p>
                                ${group.members.length} members
                            </p>

                        </div>

                        <span class="group-total">
                            ₹${total.toFixed(2)}
                        </span>

                    </div>


                    <div class="group-members">

                        ${group.members
                            .map(
                                member => `
                                    <span>
                                        ${escapeHTML(member)}
                                    </span>
                                `
                            )
                            .join("")}

                    </div>


                    <button
                        class="primary-btn"
                        onclick="openGroup(${group.id})"
                    >
                        Open Group
                    </button>

                </div>
            `;

        })
        .join("");
}


/* =========================================
   OPEN GROUP
========================================= */

async function openGroup(groupId) {

    try {

        const response =
            await fetch(
                `/api/groups/${groupId}`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {
            handleUnauthorized();
            return;
        }


        if (!response.ok) {

            alert("Group not found.");

            return;
        }


        const data = await response.json();

        currentGroup = data.group;


        const splitterPanel =
            document.getElementById("splitterPanel");


        if (splitterPanel) {
            splitterPanel.style.display = "block";
        }


        const groupTitle =
            document.getElementById("selectedGroupName");


        if (groupTitle) {
            groupTitle.textContent =
                currentGroup.name;
        }


        populateGroupMembers();

        displayGroupExpenses(data.expenses);

        await loadSettlement();


    } catch (error) {

        console.error(
            "Error opening group:",
            error
        );

    }
}


/* =========================================
   GROUP MEMBERS
========================================= */

function populateGroupMembers() {

    if (!currentGroup) return;

    const paidBy =
        document.getElementById("paidBy");

    const participants =
        document.getElementById("participants") ||
        document.getElementById("participantList");

    // Paid by dropdown
    if (paidBy) {

        paidBy.innerHTML = currentGroup.members
            .map(member => `
                <option value="${escapeHTML(member)}">
                    ${escapeHTML(member)}
                </option>
            `)
            .join("");

    }

    // Participants
    if (participants) {

        participants.innerHTML = currentGroup.members
            .map(member => `
                <label class="checkbox-item">
                    <input
                        type="checkbox"
                        value="${escapeHTML(member)}"
                        checked
                    >
                    ${escapeHTML(member)}
                </label>
            `)
            .join("");

    }
}

/* =========================================
   ADD GROUP EXPENSE
========================================= */

/* =========================================
   ADD GROUP EXPENSE
========================================= */

const groupExpenseForm =
    document.getElementById("groupExpenseForm");

if (groupExpenseForm) {

    groupExpenseForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (!currentGroup) {
                alert("Please select a group first.");
                return;
            }

            // Get inputs directly from the form
            const inputs =
                groupExpenseForm.querySelectorAll(
                    'input[type="text"], input[type="number"]'
                );

            const description =
                inputs[0]?.value.trim();

            const amount =
                inputs[1]?.value;

            const paidBy =
                document.getElementById("paidBy")?.value;

            // Find selected participants
            const participantInputs =
                groupExpenseForm.querySelectorAll(
                    '#participants input[type="checkbox"]:checked, ' +
                    '#participantList input[type="checkbox"]:checked'
                );

            const participants =
                Array.from(participantInputs)
                    .map(input => input.value);

            console.log("Group expense:", {
                description,
                amount,
                paidBy,
                participants
            });

            if (!description || !amount) {

                alert(
                    "Please enter description and amount."
                );

                return;
            }

            if (participants.length === 0) {

                alert(
                    "Please select at least one participant."
                );

                return;
            }

            try {

                const response = await fetch(
                    "/api/expenses",
                    {
                        method: "POST",

                        headers: authHeaders(),

                        body: JSON.stringify({

                            description: description,

                            amount: Number(amount),

                            category: "Other",

                            type: "group",

                            groupId: currentGroup.id,

                            paidBy: paidBy,

                            participants: participants

                        })
                    }
                );

                if (response.status === 401) {

                    handleUnauthorized();

                    return;
                }

                if (!response.ok) {

                    const errorData =
                        await response.json();

                    alert(
                        errorData.message ||
                        "Could not add shared expense."
                    );

                    return;
                }

                groupExpenseForm.reset();

                await loadExpenses();

                await openGroup(currentGroup.id);

                alert(
                    "Shared expense added successfully! 🎉"
                );

            } catch (error) {

                console.error(
                    "Error adding group expense:",
                    error
                );

                alert(
                    "Something went wrong while adding the shared expense."
                );

            }

        }
    );
}


/* =========================================
   DISPLAY GROUP EXPENSES
========================================= */

function displayGroupExpenses(groupExpenses) {

    const container =
        document.getElementById("groupExpenseList");

    if (!container) return;


    if (
        !groupExpenses ||
        groupExpenses.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                No shared expenses yet.
            </div>
        `;

        return;
    }


    container.innerHTML =
        groupExpenses
            .map(expense => {

                return `
                    <div class="expense-item">

                        <div class="expense-icon">
                            💸
                        </div>

                        <div class="expense-info">

                            <strong>
                                ${escapeHTML(
                                    expense.description
                                )}
                            </strong>

                            <span>
                                Paid by
                                ${escapeHTML(
                                    expense.paidBy || "Unknown"
                                )}
                            </span>

                        </div>

                        <div class="expense-amount">
                            ₹${Number(
                                expense.amount
                            ).toFixed(2)}
                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================
   LOAD SETTLEMENT
========================================= */

async function loadSettlement() {

    if (!currentGroup) return;


    try {

        const response =
            await fetch(
                `/api/groups/${currentGroup.id}/settlement`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {

            handleUnauthorized();

            return;
        }


        if (!response.ok) {

            throw new Error(
                "Could not load settlement"
            );

        }


        const data =
            await response.json();


        displaySettlement(data);


    } catch (error) {

        console.error(
            "Error loading settlement:",
            error
        );

    }
}


/* =========================================
   DISPLAY SETTLEMENT
========================================= */

function displaySettlement(data) {

    const container =
        document.getElementById("settlement");

    if (!container) return;


    let html = `

        <div class="settlement-section">

            <h3>
                💰 Balances
            </h3>

            <div class="balances">

    `;


    Object.entries(data.balances || {})
        .forEach(([person, balance]) => {

            const rounded =
                Number(balance.toFixed(2));


            let message = "Settled";


            if (rounded > 0) {

                message =
                    `Gets ₹${Math.abs(rounded).toFixed(2)}`;

            }

            else if (rounded < 0) {

                message =
                    `Owes ₹${Math.abs(rounded).toFixed(2)}`;

            }


            html += `

                <div class="balance-item">

                    <span>
                        ${escapeHTML(person)}
                    </span>

                    <strong>
                        ${message}
                    </strong>

                </div>

            `;

        });


    html += `

            </div>

            <h3>
                🔄 Settlement
            </h3>

            <div class="settlement-list">

    `;


    if (
        !data.settlements ||
        data.settlements.length === 0
    ) {

        html += `

            <p>
                Everyone is settled! 🎉
            </p>

        `;

    }

    else {

        data.settlements.forEach(settlement => {

            html += `

                <div class="settlement-item">

                    <strong>
                        ${escapeHTML(
                            settlement.from
                        )}
                    </strong>

                    owes

                    <strong>
                        ${escapeHTML(
                            settlement.to
                        )}
                    </strong>

                    <span>
                        ₹${Number(
                            settlement.amount
                        ).toFixed(2)}
                    </span>

                </div>

            `;

        });

    }


    html += `

            </div>

        </div>

    `;


    container.innerHTML = html;
}


/* =========================================
   HTML SECURITY
========================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================
   INITIALIZE APPLICATION
========================================= */

async function initializeApp() {

    if (!token) {
        return;
    }

    await loadExpenses();

    await loadGroups();
}


/* =========================================
   START APPLICATION
========================================= */

initializeApp();
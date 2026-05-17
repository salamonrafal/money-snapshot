const messageElement = document.querySelector("#login-message");

let messages = {};

function updateMessage() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error")) {
        messageElement.textContent = messages["login.error"];
        messageElement.dataset.type = "error";
        return;
    }
    if (params.has("logout")) {
        messageElement.textContent = messages["login.logout"];
        messageElement.dataset.type = "success";
        return;
    }

    messageElement.textContent = "";
    messageElement.dataset.type = "";
}

MoneySnapshotI18n.init({
    endpoint: "/api/login/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        messages = nextMessages;
        document.title = `${messages["login.heading.title"]} | ${messages["app.name"]}`;
        updateMessage();
    }
}).catch((error) => {
    console.error(error);
});

const { google } = require("googleapis");

// Get the user's email address and password
const email = process.env.GMAIL_ADDRESS;

// Create a new OAuth2 client
const client = new google.auth.OAuth2(
  "577711671361-tnercb7qdv6vlk0eg8t1djeggtc4p9qn.apps.googleusercontent.com",
  "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",
  "http://localhost:8080/oauth2/callback"
);

// Request authorization
const authorizeUrl = client.generateAuthUrl({
  access_type: "offline",
  scope: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://mail.google.com/",
  ],
});

// Print the authorization URL and ask the user to visit it
console.log(`Please visit this URL to authorize the app: ${authorizeUrl}`);

// Get the authorization code from the user
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});
readline.question("Enter the authorization code: ", async (code) => {
  readline.close();
  // Get the access token
  client.getToken(code, async (err, token) => {
    // Check for errors
    if (err) {
      console.log(err);
      return;
    }

    // Set the access token
    client.setCredentials(token);
    // Get the Gmail API client
    const gmail = google.gmail({
      version: "v1",
      auth: client,
    });
    // Check if the user is logged in
    if (
      gmail &&
      gmail.context &&
      gmail.context._options &&
      gmail.context._options.auth &&
      gmail.context._options.auth.credentials.access_token
    ) {
        await getInbox();
      // Get the user's inbox
      async function getInbox() {
        const inbox = await gmail.users.messages.list({
          userId: "me",
          q: "is:unread",
        });
        // Loop through the messages in the inbox
        if (inbox.data.messages) {
          for (const message of inbox.data.messages) {
            // Get the full message details
            const messageDetails = await gmail.users.messages.get({
              userId: "me",
              id: message.id,
            });

            // Check if the message has no prior replies
            if (
              messageDetails.data.threadId &&
              messageDetails.data.payload.headers.filter(
                (header) =>
                  header.name === "Subject" && header.value.startsWith("Re:")
              ).length === 0
            ) {
              // Send a reply to the message
              const reply = {
                from: email,
                to: messageDetails.data.payload.headers.filter(
                  (header) => header.name === "From"
                )[0].value,
                subject:
                  "Re: " +
                  messageDetails.data.payload.headers.filter(
                    (header) => header.name === "Subject"
                  )[0].value,
                text: "Hello,\n\nThis is an automated reply.\n\nThanks,\nYour Vacation Bot",
              };

              // Send the reply
              gmail.users.messages.send({
                userId: "me",
                resource: {
                  raw: Buffer.from(
                    `From: ${reply.from}\nTo: ${reply.to}\nSubject: ${reply.subject}\n\n${reply.text}`
                  ).toString("base64"),
                  threadId: messageDetails.data.threadId,
                },
              });

              const label = "Vacation";
              // Check if the label already exists
              const labelList = await gmail.users.labels.list({
                userId: "me",
              });
              let labelinfo;
              const check = labelList.data.labels.find(
                (labelData) => labelData.name === label
              );
              labelinfo = check;
              if (!check) {
                // Create the label
                labelinfo = await gmail.users.labels.create({
                  userId: "me",
                  requestBody: {
                    labelListVisibility: "labelShow",
                    messageListVisibility: "show",
                    name: label,
                  },
                });
              }

              // Add the label to the message
              await gmail.users.messages.modify({
                userId: "me",
                id: message.id,
                requestBody: {
                  addLabelIds: [labelinfo.id],
                  removeLabelIds: ["INBOX"],
                },
              });
            }
          }
        }
        // Repeat the process in random intervals of 45 to 120 seconds
        setTimeout(() => {
            // Check for new emails
            getInbox();
          }, Math.floor(Math.random() * 75) + 45000);
      }
      
    } else {
      // The user is not logged in
      console.log("Please log in to Gmail before using this app.");
    }
  });
});

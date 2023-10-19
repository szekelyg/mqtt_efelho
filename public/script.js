// public/script.js
let selectedDevice = null;
let previousDevices = {};


function deselectAllDevices() {
    const deviceBoxes = document.querySelectorAll('.deviceBox');
    deviceBoxes.forEach(box => box.classList.remove('selected'));
}

function fetchDevices() {
    fetch('/devices/status')
        .then(response => response.json())
        .then(data => {
            const deviceContainer = document.getElementById('deviceContainer');
            deviceContainer.innerHTML = '';
            for (const device in data) {
                if (data[device].status === 'online') {
                    const deviceBox = document.createElement('div');
                    deviceBox.className = 'deviceBox';
                    deviceBox.textContent = device;
                    deviceBox.onmouseover = function() {
                        this.style.backgroundColor = "lightgray";
                    };
                    deviceBox.onmouseout = function() {
                        this.style.backgroundColor = "";
                    };
                    deviceBox.onclick = function() {
                        deselectAllDevices();
                        selectedDevice = this.textContent;
                        this.style.backgroundColor = "lightblue";
                        document.getElementById("selectedDeviceDisplay").innerText = `Selected Device: ${selectedDevice}`;
                    };
                    deviceContainer.appendChild(deviceBox);
                }
            }
        });
}

function deselectAllDevices() {
    const deviceBoxes = document.querySelectorAll('.deviceBox');
    deviceBoxes.forEach(box => {
        box.style.backgroundColor = "";
    });
}


// Send a command to the selected device
function sendCommand() {
    const commandInput = document.getElementById('commandInput');
    const message = document.getElementById('message');
    if (selectedDevice) {
        fetch('/api/send-command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device: selectedDevice,
                command: commandInput.value
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                message.textContent = 'Command sent successfully!';
            } else {
                message.textContent = data.message;
            }
            commandInput.value = '';
            // Az üzenet eltüntetése 3 másodperc után
            setTimeout(() => {
                message.textContent = '';
            }, 3000);
        });
    } else {
        message.textContent = 'Please select a device first.';
    }
}

function selectDevice(deviceName) {
    selectedDevice = deviceName;
    document.getElementById("selectedDevice").innerText = `Selected Device: ${selectedDevice}`;
  
    // Send the selected device to the server for logging
    fetch('/api/select-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device: selectedDevice })
    })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        console.error(data.message);
      }
    })
    .catch(error => {
      console.error('Error selecting device:', error);
    });
  }
  

// Fetch the devices every 10 seconds
setInterval(fetchDevices, 1000);



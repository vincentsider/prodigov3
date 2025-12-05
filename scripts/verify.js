const fs = require('fs');
const path = require('path');

async function runVerification() {
    const API_URL = 'http://localhost:3000/api/v1/files';
    const API_KEY = 'test-secret'; // We need to set this when running the server

    // 1. Create a dummy file
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'Hello, World! This is a test file.');

    try {
        console.log('--- Starting Verification ---');

        // 2. Upload File
        console.log('\n1. Uploading file...');
        const formData = new FormData();
        const fileBlob = new Blob([fs.readFileSync(testFilePath)], { type: 'text/plain' });
        formData.append('file', fileBlob, 'test-upload.txt');
        formData.append('customer_id', 'cus_123');
        formData.append('source', 'verification-script');
        formData.append('metadata', JSON.stringify({ key: 'value' }));

        const uploadRes = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            },
            body: formData
        });

        if (!uploadRes.ok) {
            throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
        }

        const uploadData = await uploadRes.json();
        console.log('Upload successful:', uploadData);
        const fileId = uploadData.id;

        // 3. Get Metadata
        console.log(`\n2. Retrieving metadata for ID: ${fileId}...`);
        const getRes = await fetch(`${API_URL}/${fileId}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });

        if (!getRes.ok) {
            throw new Error(`Get metadata failed: ${getRes.status} ${await getRes.text()}`);
        }

        const getData = await getRes.json();
        console.log('Metadata retrieved:', getData);

        if (getData.id !== fileId) {
            throw new Error('ID mismatch!');
        }

        // 4. Delete File
        console.log(`\n3. Deleting file ID: ${fileId}...`);
        const deleteRes = await fetch(`${API_URL}/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });

        if (!deleteRes.ok) {
            throw new Error(`Delete failed: ${deleteRes.status} ${await deleteRes.text()}`);
        }

        console.log('Delete successful (204)');

        // 5. Verify Deletion (Get should fail)
        console.log('\n4. Verifying deletion...');
        const verifyDeleteRes = await fetch(`${API_URL}/${fileId}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });

        if (verifyDeleteRes.status === 404) {
            console.log('Verification successful: File not found as expected.');
        } else {
            throw new Error(`Expected 404, got ${verifyDeleteRes.status}`);
        }

        console.log('\n--- Verification Passed! ---');

    } catch (error) {
        console.error('\n--- Verification Failed ---');
        console.error(error);
    } finally {
        // Cleanup
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    }
}

runVerification();

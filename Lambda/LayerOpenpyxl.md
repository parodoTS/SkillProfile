# Creating and using lambda layers

Lambda layers provide a convenient way to package libraries and other dependencies that you can use with your Lambda functions. Using layers reduces the size of uploaded deployment archives and makes it faster to deploy your code.



## Step 1

Create a new directory and navigate to the directory on your computer:

    mkdir my-lambda-layer && cd my-lambda-layer
## Step 2

Next, create a folder structure for the modules that you need to install:

    mkdir -p aws-layer/python/lib/python3.7/site-packages
## Step 3

Let’s install our libraries. To install just a single module for your application, use the following command, in this example I’ll be using numpy.

    pip3 install openpyxl --target aws-layer/python/lib/python3.7/site-packages

## Step 4

Next, we navigate to the  _lambda-layer_  directory and create a zip file for the layer that will be uploaded.

    cd aws-layer
Now zip the entire folder:

     zip -r9 lambda-layer.zip .
After zipping the packages it will have the name “lambda-layer.zip”

You can upload the zip file to your lambda layer using AWS CLI or using the AWS web Console, for this article I’ll be using the AWS CLI


Reference: https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html

**To create a layer (console)**

1.  Open the  Layers page of the Lambda console.
    
2.  Choose  **Create layer**.
    
3.  Under  **Layer configuration**, for  **Name**, enter a name for your layer.
    
4.  (Optional) For  **Description**, enter a description for your layer.
    
5.  To upload your layer code, do one of the following:
    
    -   To upload a .zip file from your computer, choose  **Upload a .zip file**. Then, choose  **Upload**  to select your local .zip file.
        
    -   To upload a file from Amazon S3, choose  **Upload a file from Amazon S3**. Then, for  **Amazon S3 link URL**, enter a link to the file.
        
6.  (Optional) For  **Compatible instruction set architectures**, choose one value or both values.
    
7.  (Optional) For  **Compatible runtimes**, choose up to 15 runtimes.
    
8.  (Optional) For  **License**, enter any necessary license information.
    
9.  Choose  **Create**.

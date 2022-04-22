# What are Layers?

According to the docs, A layer is a ZIP archive that contains libraries, a  [custom runtime](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-custom.html), or other dependencies. With layers, you can use libraries in your function without needing to include them in your deployment package.

Layers let you install all the modules you need for your application to run, it provides that flexibility for you deploy your lambda function and even with layers you can even make your own custom code and add external functionality as a layer itself.

# Benefits of Layers

-   Makes your deployment package smaller and easily deployable
-   The layer can also be used across other lambda functions.
-   Make code changes quickly on the console.
-   Lambda layers enable versioning, which allows you to add more packages and also use previous package versions when needed.

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

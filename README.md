# SkillProfile



SkillProfile+GraphQL(Appsync+Dynamo)

![SkillProfile drawio](https://user-images.githubusercontent.com/100789868/164406013-a1cbf3a1-95ae-4d21-88a7-65a1ac9f671d.png)
# SkillProfile+GraphQL(Appsync+Dynamo)
### DynamoDB:
Amazon DynamoDB is a fully managed, serverless, key-value NoSQL database designed to run high-performance applications at any scale. **DynamoDB offers built-in security, continuous backups, automated multi-Region replication, in-memory caching, and data export tools.**


# Design DynamoDB table:

 DynamoDB is a schema-less database that only requires a table name and primary key when creating the table.


## Configure that it has auto scalling. To improve reading and writing.


The **read/write** capacity mode controls how you are charged for read and write performance and how you manage capacity.
### READ
**Read Capacity Auto Scaling**
Activated
**Provisioned Read Capacity Units**
1
**Provisioned interval for reads**
1 - 20
**Reading Capacity Utilization Target**
70%
### WRITE
**Write Capacity Auto Scaling**
Activated
**Provisioned Write Capacity Units**
1
**Provisioned interval for writes**
1 - 20
**Write Capacity Utilization Target**
70%

References: https://aws.amazon.com/dynamodb/getting-started/
## Lambda Function:

 Lambda is a compute service that lets you run code without provisioning or managing servers. Lambda runs your code on a high-availability compute infrastructure and performs all of the administration of the compute resources, including server and operating system maintenance, capacity provisioning and automatic scaling, code monitoring and logging. With Lambda, you can run code for virtually any type of application or backend service.

Reference: https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html

## Creation Lambda Function.

Now we create the lambda function to treat the Xlsm file to Json. Once the operation is done we have to select which columns of data we need to import them correctly in our table in DynamoDB.

From this link we can access the repository with the code: https://github.com/parodoTS/SkillProfile/blob/main/Lambda/XLSM2JSON.py

Now let´s reviews the code of the lambda functions

>import boto3
import json
import urllib.parse
from collections import OrderedDict
from itertools import islice
from openpyxl import load_workbook**


>def lambda_handler(event, context):


### Part 1:

  Connect to S3 and download the EXCEL file (to /tmp/ in Lambda)
           
           s3_client = boto3.client("s3")
	 S3_BUCKET_NAME = 'skillprofilebucket'
    object_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8') 
	   file_content = s3_client.download_file(S3_BUCKET_NAME, object_key,'/tmp/data.xlsm')

### Part 2:
 Parse data from EXCEL file to Python list using openpyxl

    wb = load_workbook('/tmp/data.xlsm')
    
    sheet1 = wb['Mapping SSP']  #Sheet with Profiles' info
    
    profile_list = []
    diccionario = {}
    
    for row in islice(sheet1.values, 3, (sheet1.max_row)-1):
        profile = OrderedDict()
        profile['ProfileID'] = row[1]
        profile['ID'] = row[1]
        profile['Name'] = row[2]
        profile['Family'] = row[16]
        profile['Cluster'] = row[17]
        profile['Description'] = row[4]
        profile_list.append(profile)
        diccionario[row[2].upper()]=row[1]
    
    
    sheet2 = wb['Skill Profiles']   #Sheet with Skills' info
    
    skill_list = []
    
    for row in islice(sheet2.values, 11, (sheet2.max_row)-1):
        skill = OrderedDict()
        skill['ProfileID'] = diccionario[row[4].upper()]
        skill['ID'] = row[5]
        skill['Category'] = row[6]
        skill['SkillName'] = row[9]
        skill['Description'] = row[10]
        Levels = OrderedDict()
        Levels['Junior'] = row[11]
        Levels['Specialist'] = row[12]
        Levels['Expert'] = row[13]
        Levels['Senior'] = row[14]
        Levels['Principal'] = row[15]
        skill['Levels']=Levels
        skill_list.append(skill)

### Part 3:
Connect to DynamoDB and upload the data to the table
 
    dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
    table = dynamodb.Table('SkillProfile')
    
    for profile in profile_list:
        table.put_item(Item=profile)
    for skill in skill_list:
        table.put_item(Item=skill)


